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
