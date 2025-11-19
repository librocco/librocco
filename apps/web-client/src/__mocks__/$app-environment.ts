/**
 * Mock for $app/environment module
 * Used in test environment where SvelteKit modules are not available
 */

export const browser = true;
export const building = false;
export const dev = true;
export const version = "test";
