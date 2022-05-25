import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

import NumberLinks from "../NumberLinks";

import { getItemsToRender } from "../getItemsToRender";

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

describe("NumberLinks", () => {
  describe("Component tests", () => {
    afterEach(() => {
      cleanup();
      jest.clearAllMocks();
    });

    test("should not explode if no inputs for 'onChange' nor 'Wrapper' provided", () => {
      render(<NumberLinks links={["link1"]} />);
      screen.getByRole("button").click();
    });

    test("should not render if there are no items to show", () => {
      render(<NumberLinks links={[]} />);
      expect(screen.queryByRole("button")).toBeFalsy();
    });

    test("should call to 'onChange' function, passing link and index of an item on item button click", () => {
      const mockOnChange = jest.fn();
      render(<NumberLinks links={["link1"]} onChange={mockOnChange} />);
      screen.getByText("1").click();
      expect(mockOnChange).toHaveBeenCalledWith("link1", 0);
    });

    test('elipsis ("...") should not be clickable', () => {
      const mockOnChange = jest.fn();
      // Generate a large enough number of links so that the elipsis has to be shown
      const dummyLinks = Array(12)
        .fill(null)
        .map((_, i) => `link-${i}`);
      render(<NumberLinks links={dummyLinks} onChange={mockOnChange} />);
      screen.getByText("...").click();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    test("should wrap buttons in 'Wrapper' component if one provided", () => {
      const MockWrapper = jest.fn();
      const dummyLinks = ["link-1", "link-2"];
      render(<NumberLinks links={dummyLinks} Wrapper={MockWrapper} />);
      expect(MockWrapper).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = MockWrapper.mock.calls;
      expect(firstCall[0].to).toEqual("link-1");
      expect(secondCall[0].to).toEqual("link-2");
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
      [{ currentItem: 10 }, [0, null, 8, 9, 10]],
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
      [{ currentItem: 10 }, [0, null, 6, 7, 8, 9, 10]],
    ]);
  });
});
