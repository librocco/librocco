export function map<T, R>(iterable: Iterable<T>, mapper: (value: T) => R): Iterable<R> {
	return iterableFromGenerator(function* () {
		for (const value of iterable) {
			yield mapper(value);
		}
	});
}

export function flatMap<T, R>(iterable: Iterable<T>, mapper: (value: T) => Iterable<R>): Iterable<R> {
	return iterableFromGenerator(function* () {
		for (const value of iterable) {
			yield* mapper(value);
		}
	});
}

export function filter<T>(iterable: Iterable<T>, predicate: (value: T) => boolean): Iterable<T> {
	return iterableFromGenerator(function* () {
		for (const value of iterable) {
			if (predicate(value)) {
				yield value;
			}
		}
	});
}

export function reduce<T>(iterable: Iterable<T>, reducer: (accumulator: T, value: T) => T, seed?: T): T;
export function reduce<T, R>(iterable: Iterable<T>, reducer: (accumulator: R, value: T) => R, seed: R): R {
	const iterator = iterable[Symbol.iterator]();
	let accumulator = seed || iterator.next().value;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const { value, done } = iterator.next();
		if (done && value === undefined) {
			break;
		}
		accumulator = reducer(accumulator, iterator.next().value);
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
export function iterableFromGenerator<T>(genFn: () => Generator<T>): Iterable<T> {
	return {
		[Symbol.iterator]: genFn
	};
}

interface TransformableIterable<T> extends Iterable<T> {
	map<R>(mapper: (value: T) => R): TransformableIterable<R>;
	flatMap<R>(bind: (value: T) => Iterable<R>): TransformableIterable<R>;
	filter(predicate: (value: T) => boolean): TransformableIterable<T>;
	reduce(reducer: (accumulator: T, value: T) => T, seed?: T): T;
	reduce<R>(reducer: (accumulator: R, value: T) => T, seed: R): R;
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
	const f = (predicate: (value: T) => boolean) => wrapIter(filter(iterable, predicate));
	const r = (reducer: (accumulator: T, value: T) => T, seed?: T) => reduce(iterable, reducer, seed);

	return {
		[Symbol.iterator]: iterable[Symbol.iterator],
		map: m,
		flatMap: fm,
		filter: f,
		reduce: r
	};
};
