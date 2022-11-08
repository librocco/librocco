/**
 * Creates an array of items to render for the `NumberLinks` component with respect to number of items, max items to show and
 * currently selected (active) item. Item might be `null` instead of number. In that case, we should render `...` istead.
 *
 * _Note: items returned as indexes (0 based) to easier pull data from a array of items. For rendering (1 based) we should add 1 to each member of the result_
 *
 * @param numItems total number of items to pick from
 * @param maxItems maximum items to display (length of the return array should be the same)
 * @param currentItem index of the current item selected
 * @returns an array of items to render
 */
export const getItemsToRender = (numItems: number, maxItems: number, currentItem: number): (number | null)[] => {
	// Avoid exploding if no items provided
	if (numItems === 0) return [];

	// Validate maxItems
	if (maxItems < 5) {
		throw new Error("Invalid prop value for 'maxItems', should be able to show at least 5 items.");
	}
	// Current item should not be out of range
	if (currentItem >= numItems || currentItem < 0) {
		const errorMessage = `Invalid value for 'currentItem' index: out of range -> 'currentItem' = ${currentItem}, defined range = [0..${
			numItems - 1
		}]`;
		throw new Error(errorMessage);
	}

	// If provided an even number of items to show (maxItems)
	// should actually show a preceeding odd number of items
	// to not mess with the rendering logic
	const numItemsToShow = maxItems % 2 === 0 ? maxItems - 1 : maxItems;

	// Show all items if all fit in range specified by 'maxItems'
	if (numItems <= numItemsToShow) {
		return Array(numItems)
			.fill(null)
			.map((_, i) => i);
	}

	// Max width (as number of items shown) of an unbroken sequence of numbers on left or right side if the 'currentItem' in the respective range
	// Example: numItems = 10, maxItems = 5, currentItem = 1
	// [0,'1',2,null,9] -> Here the longest, unbroken array (from start) is [0,1,2], length = 3
	const sideWidth = numItemsToShow - 2;
	const [isStart, isEnd] =
		numItemsToShow === 5
			? [Boolean(currentItem < sideWidth), Boolean(currentItem >= numItems - sideWidth)]
			: [Boolean(currentItem < sideWidth - 1), Boolean(currentItem > numItems - sideWidth)];

	if (isStart) {
		return new Array(sideWidth)
			.fill(null)
			.map((_, i) => i as number | null)
			.concat([null, numItems - 1]);
	}
	if (isEnd) {
		const endArr = new Array(sideWidth).fill(null).map((_, i) => {
			const computed = numItems - sideWidth + i;
			return computed;
		});
		return [0, null].concat(endArr);
	}

	// Width (as number of items shown) of central array e.g.
	// [4,5,6] in [0, null, 4, '5', 6, null, 9]   -->  currentItem being 5
	const centralWidth = numItemsToShow - 4;

	const centralArray = [currentItem];
	for (let i = 0; i < Math.floor(centralWidth / 2); i++) {
		centralArray.unshift(currentItem - 1);
		centralArray.push(currentItem + 1);
	}

	return [0, null, ...centralArray, null, numItems - 1];
};
