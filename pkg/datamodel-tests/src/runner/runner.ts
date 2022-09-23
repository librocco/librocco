import { TestDataLoader, TransformConfig } from '../types';

import { newModel } from './test-setup';

export const newTestRunner = async (loader: TestDataLoader) => {
	const [books, notes, snaps] = await Promise.all([
		loader.getBooks(),
		loader.getNotes(),
		loader.getSnaps()
	]);

	const data = { books, notes, snaps };

	return {
		newModel: (config: TransformConfig) => newModel(data, config)
	};
};
