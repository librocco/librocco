/**
 * Represents data that may still be loading (as a Promise) or already loaded.
 *
 * @template T The type of the loaded data.
 */
export type AsyncData<T> = T | Promise<T> | null;

/**
 * Type guard to check if data is still loading (is a Promise).
 */
export function isLoading<T>(data: AsyncData<T>): data is Promise<T> {
	return data instanceof Promise;
}

/**
 * Type guard to check if data is fully loaded (not null, not a Promise).
 */
export function isLoaded<T>(data: AsyncData<T>): data is T {
	return data !== null && !(data instanceof Promise);
}

/**
 * Helper to resolve AsyncData to its value.
 * Handles null (returns null) and Promise (awaits it).
 *
 * Migration Hint: When moving to Runes, consider using a `Resource` pattern
 * or a `.svelte.ts` class that wraps this logic to expose reactive `value` and `loading` states.
 */
export async function resolveAsyncData<T>(data: AsyncData<T>): Promise<T | null> {
	if (data === null) return null;
	if (data instanceof Promise) return await data;
	return data;
}
