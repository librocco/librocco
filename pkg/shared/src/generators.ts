export function map<T>(iterable: Iterable<T>, mapper: (value: T) => T): Iterable<T>;
export function map<T, R>(iterable: Iterable<T>, mapper: (value: T) => R): Iterable<R> {
	return iterableFromGenerator(function* () {
		for (const value of iterable) {
			yield mapper(value);
		}
	});
}

export function flatMap<T>(iterable: Iterable<T>, mapper: (value: T) => Iterable<T>): Iterable<T>;
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

export function reduce<T>(iterable: Iterable<T>, reducer: (accumulator: T, value: T) => T): T;
export function reduce<T>(iterable: Iterable<T>, reducer: (accumulator: T, value: T) => T, seed: T): T;
export function reduce<T, R>(iterable: Iterable<T>, reducer: (accumulator: R, value: T) => R, seed?: R): R {
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
