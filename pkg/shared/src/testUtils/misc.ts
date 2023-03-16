/**
 * @TODO This is a duplicate
 * A test helper, runs the callback with 50 ms interval until the assertion is fulfilled or it times out.
 * If it times out, it rejects with the latest error.
 * @param {Function} cb The callback to run (this would normally hold assertions)
 * @param {number} [timeout] The timeout in ms
 */
export const waitFor = (cb: () => void | Promise<void>, timeout = 2000) => {
	return new Promise<void>((resolve, reject) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let error: any = null;

		// Retry the assertion every 50ms
		const interval = setInterval(() => {
			// Run callback as a promise (this way we're able to .then/.catch regardless of the 'cb' being sync or async)
			(async () => cb())()
				.then(() => {
					if (interval) {
						clearInterval(interval);
					}
					resolve();
				})
				.catch((err) => {
					// Store the error to reject with later (if timed out)
					error = err;
				});
		}, 50);

		// When timed out, reject with the latest error
		setTimeout(() => {
			clearInterval(interval);
			reject(error);
		}, timeout);
	});
};
