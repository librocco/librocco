import { RawBook, RawSnap, RawNote, TestDataLoader, TransformConfig } from '../types';

import { TestSetup } from './testSetup';

export class Runner {
	private _rawBooks: RawBook[] = [];
	private _rawNotes: RawNote[] = [];
	private _rawSnaps: RawSnap[] = [];

	async loadData(loader: TestDataLoader) {
		const [rawBooks, rawNotes, rawSnaps] = await Promise.all([
			loader.getBooks(),
			loader.getNotes(),
			loader.getSnaps()
		]);

		this._rawBooks = rawBooks;
		this._rawNotes = rawNotes;
		this._rawSnaps = rawSnaps;
	}

	newSetup(config: TransformConfig = {}): TestSetup {
		return new TestSetup(
			{
				books: this._rawBooks,
				notes: this._rawNotes,
				snaps: this._rawSnaps
			},
			config
		);
	}
}
