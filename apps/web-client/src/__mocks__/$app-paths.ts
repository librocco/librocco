/**
 * Mock for $app/paths module
 * Used in test environment where SvelteKit modules are not available
 */

export const base = "";
export const assets = "";
export const resolveRoute = (route: string) => route;
