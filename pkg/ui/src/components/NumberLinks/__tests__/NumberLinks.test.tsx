import { getItemsToRender } from "../getItemsToRender";

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
  });

  describe("Test 'getItemsToRender' for standard cases: 'numItems' substantially higher than 'maxItems'", () => {
    // We'll be using 11-long array and testing it out against 5 and 7 item display
    const numItems = 11;

    test("should show the left side, '...' and the last item if 'currentItem' lower than the highest possibly shown on the left side", () => {
      // maxItems = 5
      //
      // Used to render: 1, [2], 3, ..., 11   ->   [2] being the 'currentItem' (indexed as 1)
      const want5 = [0, 1, 2, null, 10];
      expect(getItemsToRender(numItems, 5, 1)).toEqual(want5);

      // maxItems = 7
      //
      // Used to render: 1, 2, 3, [4], 5, ..., 11   ->   [4] being the 'currentItem' (indexed as 3)
      const want7 = [0, 1, 2, 3, 4, null, 10];
      expect(getItemsToRender(numItems, 7, 3)).toEqual(want7);
    });

    test("should show the first item, '...' and the right side if 'currentItem' higher than the lowest possibly shown on the right side", () => {
      // maxItems = 5
      //
      // Used to render: 1, ..., 9, [10], 11   ->   [10] being the 'currentItem' (indexed as 9)
      const want5 = [0, null, 8, 9, 10];
      expect(getItemsToRender(numItems, 5, 9)).toEqual(want5);

      // maxItems = 7
      //
      // Used to render: 1, ..., 7, [8], 9, 10, 11   ->   [8] being the 'currentItem' (indexed as 7)
      const want7 = [0, null, 6, 7, 8, 9, 10];
      expect(getItemsToRender(numItems, 7, 7)).toEqual(want7);
    });

    test("should show the first item, '...', range around central item, '...' and the last item, if currentItem not within start or end rage", () => {
      // maxItems = 5
      //
      // Used to render: 1, ..., [4], ..., 11   ->   [4] being the 'currentItem' (indexed as 3)
      const want5 = [0, null, 3, null, 10];
      expect(getItemsToRender(numItems, 5, 3)).toEqual(want5);

      // maxItems = 7
      //
      // Used to render: 1, ..., 4, [5], 6, ..., 11   ->   [6] being the 'currentItem' (indexed as 5)
      const want7 = [0, null, 3, 4, 5, null, 10];
      expect(getItemsToRender(numItems, 7, 4)).toEqual(want7);
    });

    test("should render all of the items if 'numItems <= maxItems'", () => {
      const numItems = 5;
      // Want is the same for both cases as 5-length fits the items prefectly and 7 still shows 5 as there aren't any more to show
      // Used to render: 1, 2, 3, 4, 5   ->   'currentItem' is unimportant here
      const want = [0, 1, 2, 3, 4];
      // maxItems = 5
      expect(getItemsToRender(numItems, 5, 2)).toEqual(want);
      expect(getItemsToRender(numItems, 7, 2)).toEqual(want);
    });

    test("edge case: should show left side even if 'currentItem = 2' for 'maxItems = 5'", () => {
      // Used to render: 1, 2, [3], ..., 11   ->   [3] being the 'currentItem' (indexed as 2)
      const want = [0, 1, 2, null, 10];
      expect(getItemsToRender(numItems, 5, 2)).toEqual(want);
    });
    test("edge case: should show right side even if 'currentItem = numItems - 3' for 'maxItems = 5'", () => {
      // Used to render: 1, ..., [9], 10, 11   ->   [9] being the 'currentItem' (indexed as 8)
      const want = [0, null, 8, 9, 10];
      expect(getItemsToRender(numItems, 5, 8)).toEqual(want);
    });
  });
});
