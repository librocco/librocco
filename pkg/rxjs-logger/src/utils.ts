import { ValueWithMeta } from "./types";

export function reduce<T>(iterable: Iterable<T>, cb: (acc: T, curr: T, i: number) => T, initial?: T): T;
export function reduce<T, I>(iterable: Iterable<T>, cb: (acc: I, curr: T, i: number) => I, initial: I): I;

export function reduce<T, R = T>(iterable: Iterable<T>, cb: (acc: R, curr: T, i: number) => R, initial?: R): R {
	const _reduce = (iterator: Iterator<T>, acc: R, i: number): R => {
		const { value: curr, done } = iterator.next();
		return done ? acc : _reduce(iterator, cb(acc, curr, i), i + 1);
	};

	const iterator = iterable[Symbol.iterator]();
	const initialValue = initial ?? iterator.next().value;

	return _reduce(iterator, initialValue, 0);
}

export const map = <T, R>(iterable: Iterable<T>, cb: (el: T) => R): Iterable<R> =>
	(function* () {
		for (const el of iterable) {
			yield cb(el);
		}
	})();

export const avg = (iterable: Iterable<number>) => {
	const [sum, total] = reduce(iterable, (acc, curr, i) => [acc[0] + curr, i + 1], [0, 0]);
	return sum / total;
};

/**
 * A helper function, used to check whether or not the valueWithMeta object
 * contains the required properties to be logged.
 * @param valueWithMeta
 * @returns
 */
export const shouldLog = (valueWithMeta: ValueWithMeta): valueWithMeta is Required<ValueWithMeta> =>
	Boolean(valueWithMeta.pipelineId && valueWithMeta.transmissionId);
