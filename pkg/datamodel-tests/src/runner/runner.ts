import { TestDataLoader, TransformConfig } from '../types';

import { TestSetup } from './testSetup';

export const newTestRunner = async (loader: TestDataLoader) => {
	const [books, notes, snaps] = await Promise.all([
		loader.getBooks(),
		loader.getNotes(),
		loader.getSnaps()
	]);

	const data = { books, notes, snaps };

	return {
		newModel: (config: TransformConfig) => new TestSetup(data, config)
	};
};
