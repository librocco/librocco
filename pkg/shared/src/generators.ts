type ReusableGenerator<T> = {
	[Symbol.iterator]: () => Generator<T>;
};

export function map<T, R>(iterable: Iterable<T>, mapper: (value: T) => R): ReusableGenerator<R> {
	return iterableFromGenerator(function* () {
		for (const value of iterable) {
			yield mapper(value);
		}
	});
}

export function flatMap<T, R>(iterable: Iterable<T>, mapper: (value: T) => Iterable<R>): ReusableGenerator<R> {
	return iterableFromGenerator(function* () {
		for (const value of iterable) {
			yield* mapper(value);
		}
	});
}

export function _groupIntoMap<T, K, V>(iterable: Iterable<T>, selector: (entry: T) => [K, V]): Map<K, Iterable<V>> {
	const map = new Map<K, V[]>();
	const add = (key: K, value: V) => map.get(key)?.push(value) || map.set(key, [value]);
	for (const entry of iterable) {
		add(...selector(entry));
	}
	return map;
}

export function _group<T, K, V>(iterable: Iterable<T>, selector: (entry: T) => [K, V]): Iterable<[K, Iterable<V>]> {
	return wrapIter([..._groupIntoMap(iterable, selector)]);
}

export function filter<T, S extends T>(iterable: Iterable<T>, predicate: (value: T) => value is S): ReusableGenerator<S>;
export function filter<T>(iterable: Iterable<T>, predicate: (value: T) => boolean): ReusableGenerator<T>;
export function filter<T>(iterable: Iterable<T>, predicate: (value: T) => boolean): ReusableGenerator<T> {
	return iterableFromGenerator(function* () {
		for (const value of iterable) {
			if (predicate(value)) {
				yield value;
			}
		}
	});
}

export function partition<T, S extends T>(
	iterable: Iterable<T>,
	predicate: (value: T) => value is S
): [ReusableGenerator<S>, ReusableGenerator<Exclude<T, S>>];
export function partition<T>(iterable: Iterable<T>, predicate: (value: T) => boolean): [ReusableGenerator<T>, ReusableGenerator<T>];
export function partition<T>(iterable: Iterable<T>, predicate: (value: T) => boolean): [ReusableGenerator<T>, ReusableGenerator<T>] {
	return [filter(iterable, predicate), filter(iterable, (value) => !predicate(value))] as const;
}

export function slice<T>(iterable: Iterable<T>, start: number, end: number): ReusableGenerator<T> {
	return iterableFromGenerator(function* () {
		const iterator = iterable[Symbol.iterator]();

		let i = 0;

		while (i < end) {
			// If end out of bounds, simply stop
			const { value, done } = iterator.next();
			if (done && value === undefined) {
				break;
			}

			if (i >= start) {
				// @ts-expect-error TODO @IVAN: `Iterable<T>` does not define an index signature
				yield iterable[i];
			}

			i++;
		}
	});
}

export function zip<A extends readonly Iterable<unknown>[]>(
	...iterables: A
): ReusableGenerator<{ [K in keyof A]: A[K] extends Iterable<infer T> ? T : never }> {
	return iterableFromGenerator(function* () {
		const iterators = iterables.map((iterable) => iterable[Symbol.iterator]());
		while (true) {
			const results = iterators.map((iterator) => iterator.next());

			// Run the loop until all iterators are done
			if (results.every((result) => result.done)) {
				break;
			}

			yield results.map((result) => result.value) as any;
		}
	});
}

export class EmptyIterableError extends Error {
	constructor() {
		super("Cannot reduce empty iterable without seed");
	}
}

export function reduce<T, R>(iterable: Iterable<T>, reducer: (accumulator: R, value: T) => R, seed: R): R;
export function reduce<T>(iterable: Iterable<T>, reducer: (accumulator: T, value: T) => T, seed?: T): T;
export function reduce<T>(iterable: Iterable<T>, reducer: (accumulator: T, value: T) => T, seed: T): T {
	const iterator = iterable[Symbol.iterator]();

	// If iterable empty, fall back to seed (if provided), if no seed throw an error
	// Note: We're acquring a new iterator here, not to mess with the one used for processing
	const { done: isEmpty } = iterable[Symbol.iterator]().next();
	if (isEmpty) {
		if (seed === undefined) {
			throw new EmptyIterableError();
		}
		return seed;
	}

	let accumulator = seed ?? iterator.next().value;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const { value, done } = iterator.next();
		if (done && value === undefined) {
			break;
		}
		accumulator = reducer(accumulator, value);
	}

	return accumulator;
}

/**
 * Iterable from generator produces an iterable from a generator function.
 * The created iterable can be reused (as opposed to a generator) as it's `[Symbol.iterator]` is the generator function
 * (returning a new generator each time it's called).
 *
 * Unlike other forms of Iterables it holds no internal structures (other than the generator function) and merely references
 * the structures used by the generator function (if any).
 * @param genFn
 * @returns
 */
export function iterableFromGenerator<T>(genFn: () => Generator<T>): ReusableGenerator<T> {
	return {
		[Symbol.iterator]: genFn
	};
}

interface TransformableIterable<T> extends Iterable<T> {
	map<R>(mapper: (value: T) => R): TransformableIterable<R>;
	flatMap<R>(bind: (value: T) => Iterable<R>): TransformableIterable<R>;
	_group<K, V>(selector: (entry: T) => [K, V]): Iterable<[K, Iterable<V>]>;
	_groupIntoMap<K, V>(selector: (entry: T) => [K, V]): Map<K, Iterable<V>>;
	filter<S extends T>(predicate: (value: T) => value is S): TransformableIterable<S>;
	filter(predicate: (value: T) => boolean): TransformableIterable<T>;
	partition<S extends T>(predicate: (value: T) => value is S): [TransformableIterable<S>, TransformableIterable<Exclude<T, S>>];
	partition(predicate: (value: T) => boolean): [TransformableIterable<T>, TransformableIterable<T>];
	slice(start: number, end: number): TransformableIterable<T>;
	zip<A extends readonly Iterable<unknown>[]>(
		...iterables: A
	): TransformableIterable<[T, ...{ [K in keyof A]: A[K] extends Iterable<infer E> ? E : never }]>;
	reduce<R>(reducer: (accumulator: R, value: T) => R, seed: R): R;
	reduce(reducer: (accumulator: T, value: T) => T, seed?: T): T;
	array(): T[];
}

/**
 * Wrap an iterable with a set of transformation methods akin to array methods.
 * The api (call signatures) is the same as with array methods, but each method returns a new iterable
 * instead of an array (The iterable is not evaluated until it's iterated over).
 *
 * The returned iterable is already wrapped with the same set of methods, allowing for chaining (like in the array methods api).
 *
 * _Note: under the hood, the transformations are implemented using generator functions, but the returned iterable is reusable (as opposed to a generator)_
 * _Note: if the input iterable contains any additional methods (e.g. a Map), they will be lost, as `wrapIter` takes in only the `[Symbol.iterator]` from the input._
 *
 * @example
 * ```ts
 * // Using array as an example, but the same applies to all types that implement the iterable interface
 * const iterable = wrapIter([1, 2, 3])
 * const result = iterable
 * 		.map(mapper)
 * 		.flatMap(flatMapper)
 * 		.filter(predicate)
 * 		.reduce(reducer, seed);
 * ```
 * @param iterable
 * @returns
 */
export const wrapIter = <T>(iterable: Iterable<T>): TransformableIterable<T> => {
	const m = <R>(mapper: (value: T) => R) => wrapIter(map(iterable, mapper));
	const fm = <R>(mapper: (value: T) => Iterable<R>) => wrapIter(flatMap(iterable, mapper));
	const _g = <K, V>(selector: (entry: T) => [K, V]) => wrapIter(_group(iterable, selector));
	const _gim = <K, V>(selector: (entry: T) => [K, V]) => _groupIntoMap(iterable, selector);
	const f = (predicate: (value: T) => boolean) => wrapIter(filter(iterable, predicate));
	const p = <S extends T>(predicate: (value: T) => value is S) => {
		const [a, b] = partition(iterable, predicate);
		return [wrapIter(a), wrapIter(b)] as [TransformableIterable<S>, TransformableIterable<Exclude<T, S>>];
	};
	const s = (start: number, end: number) => wrapIter(slice(iterable, start, end));
	const z = <A extends readonly Iterable<unknown>[]>(...iterables: A) => wrapIter(zip(iterable, ...iterables));

	const r = (reducer: (accumulator: T, value: T) => T, seed?: T) => reduce(iterable, reducer, seed);

	return {
		[Symbol.iterator]: iterable[Symbol.iterator],
		map: m,
		flatMap: fm,
		_group: _g,
		_groupIntoMap: _gim,
		filter: f,
		partition: p,
		slice: s,
		reduce: r,
		zip: z,
		array: () => Array.from(iterable)
	};
};
