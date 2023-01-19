/**
 * Waits for a condition to be met and resolves with the value.
 * If the condition is not met within the timeout, the promise is rejected with the latest value retrieved by the `getValue` function.
 *
 * @TODO We might want to convert this into a custom matcher.
 *
 * @param getValue a function that returns the value to be checked against the condition
 * @param condition a function that takes the value and returns a boolean (true if the condition is met)
 * @param timeout (optional) the timeout in milliseconds (default: 1000)
 */
export const waitForCondition = <V>(getValue: () => V, condition: (value: V) => boolean, timeout = 1000) => {
	return new Promise((resolve, reject) => {
		// Set a timeout to reject the promise if the condition is not met within the timeout
		const t = setTimeout(() => {
			// Reject with the latest value
			reject(getValue());
		}, timeout);

		const interval = setInterval(() => {
			const value = getValue();
			if (condition(value)) {
				clearTimeout(t);
				clearInterval(interval);
				resolve(value);
			}
		}, 100);
	});
};
