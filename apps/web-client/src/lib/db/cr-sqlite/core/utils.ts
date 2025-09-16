export async function checkOPFSFileExists(fname: string) {
	const dir = await window.navigator.storage.getDirectory();
	try {
		await dir.getFileHandle(fname, { create: false });
		return true;
	} catch (err) {
		// Predictable
		if ((err as Error).name === "NotFoundError") {
			return false;
		}

		// Unknown - throw
		throw err;
	}
}
