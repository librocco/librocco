import * as net from "net";

export function getPort(): Promise<number> {
	const testSocket = new net.Socket();

	return new Promise<number>((resolve) => {
		testSocket.on("error", () => {
			console.log("Using development server on local port 5173");
			testSocket.destroy();
			resolve(5173);
		});

		testSocket.connect(4173, "localhost", () => {
			console.log("Using preview build on local port 4173");
			testSocket.end();
			resolve(4173);
		});
	});
}

const port = await getPort();
export const baseURL = `http://localhost:${port}`;

/** Max timeout for DOM assertions (waitFor, etc. - longer in CI, default in non-CI) */
export const assertionTimeout = process.env.CI ? 15000 : undefined;
