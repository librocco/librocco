import { expect } from 'vitest';

import { TestFunction, VolumeQuantityTuple } from './types';

export const commit100Notes: TestFunction = async (db, getNotesAndWarehouses) => {
	const { fullStock, notes } = getNotesAndWarehouses(100);

	const w = db.warehouse();

	const noteUpdates = notes.map(
		(note) =>
			new Promise<void>((resolve, reject) => {
				(note.type === 'inbound' ? w.createInNote() : w.createOutNote())
					.then((n) =>
						n.addVolumes(
							...note.books.map(({ isbn, quantity }) => [isbn, quantity] as VolumeQuantityTuple)
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
