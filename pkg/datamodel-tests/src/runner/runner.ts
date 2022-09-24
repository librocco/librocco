import { TestDataLoader, TestSetup } from '@/types';

import { newModel } from '@runner/test-setup';

export const newTestRunner = async (loader: TestDataLoader) => {
	const [books, notes, snaps] = await Promise.all([
		loader.getBooks(),
		loader.getNotes(),
		loader.getSnaps()
	]);

	const data = { books, notes, snaps };

	return {
		newModel: (setup: TestSetup) => newModel(data, setup)
	};
};
