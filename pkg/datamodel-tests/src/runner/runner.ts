import PouchDB from 'pouchdb';
import MemoryAdapter from 'pouchdb-adapter-memory';

import { TestDataLoader, ImplementationSetup } from '@/types';

import { newModel } from '@runner/test-setup';

// Enable running of the tests against in-memory PouchDB
PouchDB.plugin(MemoryAdapter);

export const newTestRunner = async (loader: TestDataLoader) => {
	const [notes, snaps] = await Promise.all([loader.getNotes(), loader.getSnaps()]);

	const data = { notes, snaps };

	return {
		newModel: (config: ImplementationSetup) => newModel(data, config)
	};
};
