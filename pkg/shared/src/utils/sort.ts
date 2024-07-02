/**
 * A comparison operator used to (declaratively) sort an array in ascending order. It operates on
 * two modes:
 * - primitive - on primitive values (string, number) it compares them directly
 * - transformed - accepts a selector callback used to derive a primitive from the value operating on (selecting a property)
 * of an object or transforming a primitive value into another primitive value
 *
 * The result is strict 1 or -1 - values are deemed equal, it returns 0, allowing us to chain multiple comparators.
 *
 * @example
 * // Primitive
 * const nums = [1, 3, 5]
 * nums.sort(asc()) // [1, 3, 5]
 *
 * // Transformed
 * const objs = [{ a: 1 }, { a: 3 }, { a: 2 }]
 * objs.sort(asc(({ a }) => a)) // [{ a: 1 }, { a: 2 }, { a: 3 }]
 *
 * // Composed
 * const objs = [{ a: 1, b: 2 }, { a: 1, b: 1 }, { a: 2, b: 3 }]
 * objs.sort(
 *  composeCompare(
 *   asc(({ a }) => a),
 *   asc(({ b }) => b)
 * ) // [{ a: 1, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }]
 */
export function asc<T extends string | number>(): (a: T, b: T) => number;
export function asc<T, R extends string | number>(selector: (x: T) => R): (a: R, b: R) => number;
export function asc(selector?: any) {
	return (a: any, b: any) => {
		const aVal = selector ? selector(a) : a;
		const bVal = selector ? selector(b) : b;
		return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
	};
}

/**
 * A comparison operator used to (declaratively) sort an array in descending order. It operates on
 * two modes:
 * - primitive - on primitive values (string, number) it compares them directly
 * - transformed - accepts a selector callback used to derive a primitive from the value operating on (selecting a property)
 * of an object or transforming a primitive value into another primitive value
 *
 * The result is strict 1 or -1 - values are deemed equal, it returns 0, allowing us to chain multiple comparators.
 *
 * @example
 * // Primitive
 * const nums = [1, 3, 5]
 * nums.sort(desc()) // [5, 3, 1]
 *
 * // Transformed
 * const objs = [{ a: 1 }, { a: 3 }, { a: 2 }]
 * objs.sort(desc(({ a }) => a)) // [{ a: 3 }, { a: 2 }, { a: 1 }]
 *
 * // Composed
 * const objs = [{ a: 1, b: 2 }, { a: 1, b: 1 }, { a: 2, b: 3 }]
 * objs.sort(
 *  composeCompare(
 *   desc(({ a }) => a),
 *   desc(({ b }) => b)
 * ) // [{ a: 2, b: 3 }, { a: 1, b: 2 }, { a: 1, b: 1 }]
 */
export function desc<T extends string | number>(): (a: T, b: T) => number;
export function desc<T, R extends string | number>(selector: (x: T) => R): (a: R, b: R) => number;
export function desc(selector?: any) {
	return (a: any, b: any) => {
		const aVal = selector ? selector(a) : a;
		const bVal = selector ? selector(b) : b;
		return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
	};
}

/**
 * A function used to compose multiple compare functions. The implied contract is that
 * the comparison function should be strict (returning 0 for equal values).
 *
 * @example
 * const values = [{ a: 1, b: 2 }, { a: 1, b: 1 }, { a: 2, b: 3 }]
 * values.sort(
 *  composeCompare(
 *   asc(({ a }) => a),
 *   desc(({ b }) => b)
 *  )
 * ) // [{ a: 1, b: 2 }, { a: 1, b: 1 }, { a: 2, b: 3 }]
 */
export function composeCompare<T>(...comparators: ((a: T, b: T) => number)[]): (a: T, b: T) => number {
	return (a, b) => {
		for (const comparator of comparators) {
			const result = comparator(a, b);
			if (result !== 0) {
				return result;
			}
		}
		return 0;
	};
}
