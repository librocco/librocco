type GeneratorTransformer<T, A> = (iterable: Iterable<T>) => Iterable<A>;

export function map<T, R>(mapper: (value: T) => R): GeneratorTransformer<T, R> {
	return (iterable: Iterable<T>) =>
		iterableFromGenerator(function* () {
			for (const value of iterable) {
				yield mapper(value);
			}
		});
}

export function flatMap<T, R>(mapper: (value: T) => Iterable<R>): GeneratorTransformer<T, R> {
	return (iterable: Iterable<T>) =>
		iterableFromGenerator(function* () {
			for (const value of iterable) {
				yield* mapper(value);
			}
		});
}

export function filter<T>(predicate: (value: T) => boolean): GeneratorTransformer<T, T> {
	return (iterable: Iterable<T>) =>
		iterableFromGenerator(function* () {
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

export function transform<T, A>(iterable: Iterable<T>, tr1: GeneratorTransformer<T, A>): Iterable<A>;
export function transform<T, A, B>(iterable: Iterable<T>, tr1: GeneratorTransformer<T, A>, tr2: GeneratorTransformer<A, B>): Iterable<B>;
export function transform<T, A, B, C>(
	iterable: Iterable<T>,
	tr1: GeneratorTransformer<T, A>,
	tr2: GeneratorTransformer<A, B>,
	tr3: GeneratorTransformer<B, C>
): Iterable<C>;
export function transform<T, A, B, C, D>(
	iterable: Iterable<T>,
	tr1: GeneratorTransformer<T, A>,
	tr2: GeneratorTransformer<A, B>,
	tr3: GeneratorTransformer<B, C>,
	tr4: GeneratorTransformer<C, D>
): Iterable<D>;
export function transform<T, A, B, C, D, E>(
	iterable: Iterable<T>,
	tr1: GeneratorTransformer<T, A>,
	tr2: GeneratorTransformer<A, B>,
	tr3: GeneratorTransformer<B, C>,
	tr4: GeneratorTransformer<C, D>,
	tr5: GeneratorTransformer<D, E>
): Iterable<E>;
export function transform<T, A, B, C, D, E, F>(
	iterable: Iterable<T>,
	tr1: GeneratorTransformer<T, A>,
	tr2: GeneratorTransformer<A, B>,
	tr3: GeneratorTransformer<B, C>,
	tr4: GeneratorTransformer<C, D>,
	tr5: GeneratorTransformer<D, E>,
	tr6: GeneratorTransformer<E, F>
): Iterable<F>;
export function transform(iterable: Iterable<any>, ...transformers: GeneratorTransformer<any, any>[]): Iterable<any>;
export function transform<T>(iterable: Iterable<T>, ...transformers: GeneratorTransformer<any, any>[]): Iterable<any> {
	return transformers.reduce((iterable, transformer) => transformer(iterable), iterable);
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
