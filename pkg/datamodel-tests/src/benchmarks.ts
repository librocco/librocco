import { expect } from 'vitest';

import { TestFunction, VolumeTransactionTuple } from './types';

export const commit20Notes: TestFunction = async (db, getNotesAndWarehouses) => {
	const { fullStock, notes } = getNotesAndWarehouses(20);

	const w = db.warehouse();

	const noteUpdates = notes.map(
		(note) =>
			new Promise<void>((resolve, reject) => {
				(note.type === 'inbound' ? w.createInNote() : w.createOutNote())
					.then((n) =>
						n.addVolumes(
							...note.books.map(({ isbn, quantity, warehouse }) => [isbn, quantity, warehouse] as VolumeTransactionTuple)
						)
					)
					.then((n) => n.commit())
					.then(() => resolve())
					.catch((err) => reject(err));
			})
	);
	await Promise.all(noteUpdates);

	const stock = await w.getStock();

	expect(stock).toEqual(fullStock.books);
};
