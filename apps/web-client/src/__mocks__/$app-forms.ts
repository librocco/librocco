/**
 * Mock for $app/forms module
 * Used in test environment where SvelteKit modules are not available
 */

import { vi } from "vitest";

// Mock enhance to return an object with destroy method, matching SvelteKit's enhance API
export const enhance = vi.fn(() => ({
	destroy: vi.fn()
}));

export const applyAction = vi.fn();
export const deserialize = vi.fn();
