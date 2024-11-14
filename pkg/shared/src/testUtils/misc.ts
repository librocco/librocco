type TimeoutConfig = {
	timeout?: number;
	pause?: number;
};
/**
 * @TODO This is a duplicate
 * A test helper, runs the callback with 50 ms interval until the assertion is fulfilled or it times out.
 * If it times out, it rejects with the latest error.
 * @param {Function} cb The callback to run (this would normally hold assertions)
 * @param {number} [timeout] The timeout in ms
 */
export const waitFor = (cb: (attempt: number) => void | Promise<void>, { timeout = 2000, pause = 50 }: TimeoutConfig = {}) => {
	return new Promise<void>((resolve, reject) => {
		let error: any = null;
		let attempt = 1;

		let current: NodeJS.Timeout;

		const attemptCallback = () => {
			Promise.resolve(cb(attempt++))
				.then(() => {
					if (current) clearTimeout(current);
					resolve();
				})
				.catch((err) => {
					error = err;
					current = setTimeout(attemptCallback, pause);
				});
		};

		attemptCallback();

		// When timed out, reject with the latest error
		setTimeout(() => {
			clearTimeout(current);
			reject(error);
		}, timeout);
	});
};
