import { expect } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { VolumeTransactionTuple } from '@librocco/db';

import { TestFunction } from './types';

export const commit20Notes: TestFunction = async (db, getNotesAndWarehouses) => {
	const { fullStock, notes } = getNotesAndWarehouses(20);

	const noteUpdates = notes.map((note) =>
		(note.type === 'inbound' ? db.warehouse(note.books[0].warehouse).create() : db.warehouse().create())
			.then((w) => w.note().create())
			.then((n) =>
				n.addVolumes(...note.books.map(({ isbn, quantity, warehouse }) => [isbn, quantity, warehouse] as VolumeTransactionTuple))
			)
			.then((n) => n.commit())
	);
	await Promise.all(noteUpdates);

	const stock = await firstValueFrom(db.warehouse().stream().entries);

	expect(stock).toEqual(fullStock.books);
};
