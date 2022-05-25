/**
 * Creates an array of items to render for the `NumberLinks` component with respect to number of items, max items to show and
 * currently selected (active) item. Item might be `null` instead of number. In that case, we should render `...` istead.
 *
 * _Note: items returned as indexes (0 indexed) to easier pull data from a array of items. For rendering (1 indexed) we should add 1 to each member of the result_
 *
 * @param numItems total number of items to pick from
 * @param maxItems maximum items to display (length of the return array should be the same)
 * @param currentItem index of the current item selected
 * @returns an array of items to render
 */
export const getItemsToRender = (
  numItems: number,
  maxItems: number,
  currentItem: number
): (number | null)[] => {
  // Validate maxItems
  if (maxItems < 5) {
    throw new Error(
      "Invalid prop value for 'maxItems', should be able to show at least 5 items."
    );
  }
  // Current item should not be out of range
  if (currentItem >= numItems || currentItem < 0) {
    const errorMessage = `Invalid value for 'currentItem' index: out of range -> 'currentItem' = ${currentItem}, defined range = [0..${
      numItems - 1
    }]`;
    throw new Error(errorMessage);
  }

  // Show all items if all fit in range specified by 'maxItems'
  if (numItems <= maxItems) {
    return Array(numItems)
      .fill(null)
      .map((_, i) => i);
  }

  // Width of central items shown
  // In the simplest scenario this would be
  //
  // maxItems = 7
  // currentItem = 4
  // numItems = 9
  //
  // 0, null, 3, 4, 5, null, 8
  //
  // Where the width of centralArray [3, 4, 5] is 3
  // To calculate this we take the number of items shown (7 in this case)
  // and subtract 4:
  // - 2 for first and last item (0 and 8 in this case)
  // - 2 for '...' on both sides
  const centralWidth = maxItems - 4;

  // Width of items shown on the side if the 'currentItem' in the range
  const sideWidth = maxItems - 2;
  const [isStart, isEnd] =
    maxItems === 5
      ? [currentItem < sideWidth, currentItem >= numItems - sideWidth]
      : [currentItem < sideWidth - 1, currentItem > numItems - sideWidth];

  if (isStart) {
    return new Array(sideWidth)
      .fill(null)
      .map((_, i) => i)
      .concat([null!, numItems - 1]);
  }
  if (isEnd) {
    const endArr = new Array(sideWidth).fill(null).map((_, i) => {
      const computed = numItems - sideWidth + i;
      return computed;
    });
    return [0, null].concat(endArr);
  }

  const centralArray = [currentItem];
  for (let i = 0; i < Math.floor(centralWidth / 2); i++) {
    centralArray.unshift(currentItem - 1);
    centralArray.push(currentItem + 1);
  }

  return [0, null, ...centralArray, null, numItems - 1];
};
