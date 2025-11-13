/**
 * Mock for $app/forms module
 * Used in test environment where SvelteKit modules are not available
 */

import { vi } from "vitest";

export const enhance = vi.fn();
export const applyAction = vi.fn();
export const deserialize = vi.fn();
