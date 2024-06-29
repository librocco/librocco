// eslint-disable-next-line no-restricted-imports
import { goto as svelteGoto } from "$app/navigation";
import { browser } from "$app/environment";

/**
 * A client/server safe `goto` it aims to replace svelte's `goto` (banned on the server) by calling the
 * original `goto` only in browser environemnt, noop otherwise
 */
export const goto = (...params: Parameters<typeof svelteGoto>) => browser && svelteGoto(...params);
