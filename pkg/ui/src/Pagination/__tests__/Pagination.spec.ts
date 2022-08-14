/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';

import Pagination from '../Pagination.svelte';

import MockLink from './MockLink.svelte';
import { mockNavigate } from './mockNavigate';

import { getItemsToRender } from '../utils';

/**
 * Runs table tests on the 'getItemsToRender' to test for all possible inputs for
 * given combination of 'numItems' and 'maxItems'
 * @param {Object} params The first input contains params constant over the entire run: `numItems` and `maxItems`
 * @param {number} params.numItems number of items (pages) we're paginating over
 * @param {number} params.maxItems number of items displayed in `Pagination` component
 * @param tests an array of test tuples: current item (used as a currently active item in the pagination) and expected return array
 */
const runTableTests = (
	{ numItems, maxItems }: { numItems: number; maxItems: number },
	tests: [{ currentItem: number }, Array<number | null>][]
) => {
	tests.forEach(([{ currentItem }, want]) => {
		test(`Input: numItems = ${numItems}, maxItems = ${maxItems}, currentItem = ${currentItem}, want = ${want}`, () => {
			expect(getItemsToRender(numItems, maxItems, currentItem)).toEqual(want);
		});
	});
};

describe('Pagination', () => {
	describe('Component tests', () => {
		afterEach(() => {
			cleanup();
			vi.clearAllMocks();
		});

		test("should not explode if no inputs for 'onPaginate' nor 'Wrapper' provided", () => {
			render(Pagination, { currentItem: 0, links: ['link1'] });
			screen.getAllByRole('button')[0].click();
		});

		test('should not render if there are no items to show', () => {
			render(Pagination, { currentItem: 0, links: [] });
			expect(screen.queryByRole('button')).toBeFalsy();
		});

		test("should call to 'onPaginate' function, passing link and index of an item on item button click", () => {
			const mockOnPaginate = vi.fn();
			render(Pagination, { currentItem: 1, links: ['link1', 'link2'], onPaginate: mockOnPaginate });
			screen.getByText('1').click();
			expect(mockOnPaginate).toHaveBeenCalledWith('link1', 0);
		});

		test("should call to 'onPaginate' function, passing previous/next link and index of 'currentItem' left/right arrow click respectively", () => {
			const mockOnPaginate = vi.fn();
			const threeItems = Array(3)
				.fill(null)
				.map((_, i) => `link-${i}`);
			render(Pagination, { links: threeItems, currentItem: 1, onPaginate: mockOnPaginate });
			const [prevButton, , , , nextButton] = screen.getAllByRole('button');
			prevButton.click();
			expect(mockOnPaginate).toHaveBeenCalledWith('link-0', 0);
			nextButton.click();
			expect(mockOnPaginate).toHaveBeenCalledWith('link-2', 2);
		});

		test('should disable prev/next buttons if no prevoius or next item respectively', () => {
			render(Pagination, { currentItem: 0, links: ['link-1'] });
			const [prevButton, , nextButton] = screen.getAllByRole('button');
			expect(prevButton).toHaveProperty('disabled', true);
			expect(nextButton).toHaveProperty('disabled', true);
		});

		test('should disable currentItem button for clicking', () => {
			render(Pagination, { currentItem: 0, links: ['link-1'] });
			const currentItemButton = screen.getByText('1');
			expect(currentItemButton).toHaveProperty('disabled', true);
		});

		test('elipsis ("...") should not be clickable', () => {
			const mockOnPaginate = vi.fn();
			// Generate a large enough number of links so that the elipsis has to be shown
			const links = Array(12)
				.fill(null)
				.map((_, i) => `link-${i}`);
			render(Pagination, { currentItem: 0, links, onPaginate: mockOnPaginate });
			screen.getByText('...').click();
			expect(mockOnPaginate).not.toHaveBeenCalled();
		});

		test("should wrap buttons in 'Wrapper' component if one provided", () => {
			const links = ['link-1', 'link-2'];
			// We're using `MockLink` to test wrapping logic
			// and asseting calls to `mockNavigate` (consumed by `MockLink`)
			render(Pagination, { currentItem: 0, links, Wrapper: MockLink });
			screen.getByText('2').click();
			expect(mockNavigate).toHaveBeenCalledWith('link-2');
		});
	});

	describe("Test 'getItemsToRender' error handling", () => {
		test("should throw an error if 'maxItems' less than 5", () => {
			let error;
			try {
				getItemsToRender(1, 1, 0);
			} catch (err) {
				error = err;
			}
			expect(error).toBeTruthy();
		});

		test("should throw an error if 'currentItem' out of range", () => {
			let tooHigh;
			try {
				getItemsToRender(1, 5, 1);
			} catch (err) {
				tooHigh = err;
			}
			expect(tooHigh).toBeTruthy();
			let tooLow;
			try {
				getItemsToRender(1, 5, -1);
			} catch (err) {
				tooLow = err;
			}
			expect(tooLow).toBeTruthy();
		});

		test("if an even number of 'maxItems' provided, should fall back to preceeding odd number", () => {
			// maxItems = 8   ->   should render 7 items
			const itemsShown = getItemsToRender(12, 8, 2).length;
			expect(itemsShown).toEqual(7);
		});

		test("trivial: should return an empty array if 'numItems === 0'", () => {
			// maxItems = 8   ->   should render 7 items
			expect(getItemsToRender(0, 5, 0)).toEqual([]);
		});
	});

	describe("Table tests for 'getItemsToRender'", () => {
		runTableTests({ numItems: 11, maxItems: 5 }, [
			//  "1"|  2 |  3 | ...| 11
			[{ currentItem: 0 }, [0, 1, 2, null, 10]],
			//   1 | "2"|  3 | ...| 11
			[{ currentItem: 1 }, [0, 1, 2, null, 10]],
			//   1 |  2 | "3"| ...| 11
			[{ currentItem: 2 }, [0, 1, 2, null, 10]],
			//   1 | ...| "4"| ...| 11
			[{ currentItem: 3 }, [0, null, 3, null, 10]],
			//   1 | ...| "5"| ...| 11
			[{ currentItem: 4 }, [0, null, 4, null, 10]],
			//   1 | ...| "6"| ...| 11
			[{ currentItem: 5 }, [0, null, 5, null, 10]],
			//   1 | ...| "7"| ...| 11
			[{ currentItem: 6 }, [0, null, 6, null, 10]],
			//   1 | ...| "8"| ...| 11
			[{ currentItem: 7 }, [0, null, 7, null, 10]],
			//   1 | ...| "9"| 10 | 11
			[{ currentItem: 8 }, [0, null, 8, 9, 10]],
			//   1 | ...|  9 |"10"| 11
			[{ currentItem: 9 }, [0, null, 8, 9, 10]],
			//   1 | ...|  9 | 10 |"11"
			[{ currentItem: 10 }, [0, null, 8, 9, 10]]
		]);
		runTableTests({ numItems: 11, maxItems: 7 }, [
			//  "1"|  2 |  3 |  4 |  5 | ...| 11
			[{ currentItem: 0 }, [0, 1, 2, 3, 4, null, 10]],
			//   1 | "2"|  3 |  4 |  5 | ...| 11
			[{ currentItem: 1 }, [0, 1, 2, 3, 4, null, 10]],
			//   1 |  2 | "3"|  4 |  5 | ...| 11
			[{ currentItem: 2 }, [0, 1, 2, 3, 4, null, 10]],
			//   1 |  2 |  3 | "4"|  5 | ...| 11
			[{ currentItem: 3 }, [0, 1, 2, 3, 4, null, 10]],
			//   1 | ...|  4 | "5"|  6 | ...| 11
			[{ currentItem: 4 }, [0, null, 3, 4, 5, null, 10]],
			//   1 | ...|  5 | "6"|  7 | ...| 11
			[{ currentItem: 5 }, [0, null, 4, 5, 6, null, 10]],
			//   1 | ...|  6 | "7"|  8 | ...| 11
			[{ currentItem: 6 }, [0, null, 5, 6, 7, null, 10]],
			//   1 | ...|  7 | "8"|  9 | 10 | 11
			[{ currentItem: 7 }, [0, null, 6, 7, 8, 9, 10]],
			//   1 | ...|  7 |  8 | "9"| 10 | 11
			[{ currentItem: 8 }, [0, null, 6, 7, 8, 9, 10]],
			//   1 | ...|  7 |  8 |  9 |"10"| 11
			[{ currentItem: 9 }, [0, null, 6, 7, 8, 9, 10]],
			//   1 | ...|  7 |  8 |  9 | 10 |"11"
			[{ currentItem: 10 }, [0, null, 6, 7, 8, 9, 10]]
		]);
	});
});
