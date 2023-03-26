/**
 * @vitest-environment jsdom
 */
import { get } from "svelte/store";
import { describe, test, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";

import Pagination from "../Pagination.svelte";

import { getItemsToRender } from "../utils";
import TestBindValue, { bindValueStore } from "$lib/__testUtils__/TestBindValue.svelte";

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
	tests: [{ currentPage: number }, Array<number | null>][]
) => {
	tests.forEach(([{ currentPage }, want]) => {
		test(`Input: numItems = ${numItems}, maxItems = ${maxItems}, currentPage = ${currentPage}, want = ${want}`, () => {
			expect(getItemsToRender(numItems, maxItems, currentPage)).toEqual(want);
		});
	});
};

describe("Pagination", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		bindValueStore.reset();
	});

	describe("Component tests", () => {
		afterEach(() => {
			cleanup();
			vi.clearAllMocks();
		});

		test("should not explode if no inputs for 'onchange' nor 'Wrapper' provided", () => {
			render(Pagination, { value: 0, numPages: 1 });
			screen.getAllByRole("button")[0].click();
		});

		test("should not render if there are no items to show", () => {
			render(Pagination, { value: 0, numPages: 0 });
			expect(screen.queryByRole("button")).toBeFalsy();
		});

		test("should call to 'onchange' function, passing link and index of an item on item button click", () => {
			const mockChange = vi.fn();
			const { component } = render(Pagination, { value: 1, numPages: 2 });
			component.$on("change", mockChange);
			screen.getByText("1").click();
			expect(mockChange.mock.calls[0][0].detail).toEqual(0);
		});

		test("should enable binding to the 'value' for current page", () => {
			render(TestBindValue, {
				props: { props: { value: 1, numPages: 2 }, Component: Pagination }
			});
			screen.getByText("1").click();
			expect(get(bindValueStore)).toEqual(0);
		});

		test("should call to 'onchange' function, passing previous/next link and index of 'value' left/right arrow click respectively", () => {
			const mockChange = vi.fn();
			const { component } = render(Pagination, { numPages: 3, value: 1 });
			component.$on("change", mockChange);
			const [prevButton, , , , nextButton] = screen.getAllByRole("button");
			prevButton.click();
			expect(mockChange.mock.calls[0][0].detail).toEqual(0);
			nextButton.click();
			expect(mockChange.mock.calls[1][0].detail).toEqual(1);
		});

		test("should disable prev/next buttons if no prevoius or next item respectively", () => {
			render(Pagination, { value: 0, numPages: 1 });
			const [prevButton, , nextButton] = screen.getAllByRole("button");
			expect(prevButton).toHaveProperty("disabled", true);
			expect(nextButton).toHaveProperty("disabled", true);
		});

		test("should disable value button for clicking", () => {
			render(Pagination, { value: 0, numPages: 1 });
			const valueButton = screen.getByText("1");
			expect(valueButton).toHaveProperty("disabled", true);
		});

		test('elipsis ("...") should not be clickable', () => {
			const mockChange = vi.fn();
			// Generate a large enough number of pages so that the elipsis has to be shown
			const numPages = 12;
			const { component } = render(Pagination, { value: 0, numPages });
			component.$on("change", mockChange);
			screen.getByText("...").click();
			expect(mockChange).not.toHaveBeenCalled();
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

		test("should throw an error if 'value' out of range", () => {
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
			[{ currentPage: 0 }, [0, 1, 2, null, 10]],
			//   1 | "2"|  3 | ...| 11
			[{ currentPage: 1 }, [0, 1, 2, null, 10]],
			//   1 |  2 | "3"| ...| 11
			[{ currentPage: 2 }, [0, 1, 2, null, 10]],
			//   1 | ...| "4"| ...| 11
			[{ currentPage: 3 }, [0, null, 3, null, 10]],
			//   1 | ...| "5"| ...| 11
			[{ currentPage: 4 }, [0, null, 4, null, 10]],
			//   1 | ...| "6"| ...| 11
			[{ currentPage: 5 }, [0, null, 5, null, 10]],
			//   1 | ...| "7"| ...| 11
			[{ currentPage: 6 }, [0, null, 6, null, 10]],
			//   1 | ...| "8"| ...| 11
			[{ currentPage: 7 }, [0, null, 7, null, 10]],
			//   1 | ...| "9"| 10 | 11
			[{ currentPage: 8 }, [0, null, 8, 9, 10]],
			//   1 | ...|  9 |"10"| 11
			[{ currentPage: 9 }, [0, null, 8, 9, 10]],
			//   1 | ...|  9 | 10 |"11"
			[{ currentPage: 10 }, [0, null, 8, 9, 10]]
		]);
		runTableTests({ numItems: 11, maxItems: 7 }, [
			//  "1"|  2 |  3 |  4 |  5 | ...| 11
			[{ currentPage: 0 }, [0, 1, 2, 3, 4, null, 10]],
			//   1 | "2"|  3 |  4 |  5 | ...| 11
			[{ currentPage: 1 }, [0, 1, 2, 3, 4, null, 10]],
			//   1 |  2 | "3"|  4 |  5 | ...| 11
			[{ currentPage: 2 }, [0, 1, 2, 3, 4, null, 10]],
			//   1 |  2 |  3 | "4"|  5 | ...| 11
			[{ currentPage: 3 }, [0, 1, 2, 3, 4, null, 10]],
			//   1 | ...|  4 | "5"|  6 | ...| 11
			[{ currentPage: 4 }, [0, null, 3, 4, 5, null, 10]],
			//   1 | ...|  5 | "6"|  7 | ...| 11
			[{ currentPage: 5 }, [0, null, 4, 5, 6, null, 10]],
			//   1 | ...|  6 | "7"|  8 | ...| 11
			[{ currentPage: 6 }, [0, null, 5, 6, 7, null, 10]],
			//   1 | ...|  7 | "8"|  9 | 10 | 11
			[{ currentPage: 7 }, [0, null, 6, 7, 8, 9, 10]],
			//   1 | ...|  7 |  8 | "9"| 10 | 11
			[{ currentPage: 8 }, [0, null, 6, 7, 8, 9, 10]],
			//   1 | ...|  7 |  8 |  9 |"10"| 11
			[{ currentPage: 9 }, [0, null, 6, 7, 8, 9, 10]],
			//   1 | ...|  7 |  8 |  9 | 10 |"11"
			[{ currentPage: 10 }, [0, null, 6, 7, 8, 9, 10]]
		]);
	});
});
