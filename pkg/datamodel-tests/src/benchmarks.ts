import { expect } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { VolumeTransactionTuple } from '@librocco/db';

import { TestFunction } from './types';

export const commit20Notes: TestFunction = async (db, version, getNotesAndWarehouses) => {
	const { fullStock, notes } = getNotesAndWarehouses(version)(20);

	const noteUpdates = notes.map((note) =>
		(note.type === 'inbound' ? db.warehouse(note.books[0].warehouseId).create() : db.warehouse().create())
			.then((w) => w.note().create())
			.then((n) =>
				n.addVolumes(
					...note.books.map(({ isbn, quantity, warehouseId }) => [isbn, quantity, warehouseId] as VolumeTransactionTuple)
				)
			)
			.then((n) => n.commit())
	);
	await Promise.all(noteUpdates);

	const stock = await firstValueFrom(db.warehouse().stream().entries);

	expect(stock).toEqual(fullStock.books);
};
