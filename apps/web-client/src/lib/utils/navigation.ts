// eslint-disable-next-line no-restricted-imports
import { goto as svelteGoto } from "$app/navigation";
import { browser } from "$app/environment";

/**
 * A client/server safe `goto` it aims to replace svelte's `goto` (banned on the server) by calling the
 * original `goto` only in browser environemnt, noop otherwise
 */
export const goto = (...params: Parameters<typeof svelteGoto>) => browser && svelteGoto(...params);

/**
 * A helper used for in-app navigation where the view is subscribed to DB events, invalidating the load fn.
 * We use this helper so as to prevent race conditions where both the current view load is invalidated (run)
 * due to DB change and we're navigating to another view.
 *
 * @example
 * ```ts
 * // subscription that invalidates the load function
 * const unsubscribe = subscribeToDBChanges(invalidateAll)
 *
 * // navigate to another view
 * const goto = racefreeGoto(unsubscribe)
 * goto('/another-view')
 * ````
 */
export const racefreeGoto =
	(disposer?: () => void) =>
	(...params: Parameters<typeof svelteGoto>) => (disposer?.(), goto(...params));
