import { NoteState } from '$lib/enums/inventory';

export const defaultNote = {
	displayName: 'Note 1',
	updatedAt: '2021-09-01T00:00:00.000Z',
	state: NoteState.Draft,
	entries: []
};

export const defaultWarehouse = {
	displayName: 'Warehouse 1',
	entries: []
};
