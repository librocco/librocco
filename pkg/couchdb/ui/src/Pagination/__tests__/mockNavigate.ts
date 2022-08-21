import { vi } from 'vitest';

/**
 * A mock function called by the `MockLink` component on click.
 * We're using this to test wrapping of the Pagination buttons with a
 * custom wrapper (passing `MockLink`) and checking calls to this function.
 */
export const mockNavigate = vi.fn();
