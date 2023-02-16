import { describe, test, expect } from 'vitest';
import { writable, get } from 'svelte/store';

import { testUtils } from '@librocco/shared';

import { NoteTempState } from '$lib/enums/inventory';
import { NoteState } from '$lib/enums/db';

import type { NoteAppState } from '$lib/types/inventory';

import { createDisplayNameStore } from '../display_name';

import { newTestDB } from '$lib/__testUtils__/db';

const { waitFor } = testUtils;

describe('createDisplayNameStore', () => {
	test('should stream the display name from the db for given note/warehouse id', async () => {
		const db = newTestDB();
		const warehouse = await db.warehouse('warehouse-1').create();
		const note = await warehouse.note().create();

		// Test for note
		await note.setName('Note 1');

		const ndn$ = createDisplayNameStore(note);
		let noteDisplayName: string | undefined;
		ndn$.subscribe((ndn) => (noteDisplayName = ndn));

		await waitFor(() => {
			expect(noteDisplayName).toEqual('Note 1');
		});

		ndn$.set('Note 1 updated');
		await waitFor(() => {
			expect(noteDisplayName).toEqual('Note 1 updated');
		});

		// Test for warehouse
		await warehouse.setName('Warehouse 1');

		const wdn$ = createDisplayNameStore(warehouse);
		let warehouseDisplayName: string | undefined;
		wdn$.subscribe((wdn) => (warehouseDisplayName = wdn));

		await waitFor(() => {
			expect(warehouseDisplayName).toEqual('Warehouse 1');
		});

		wdn$.set('Warehouse 1 updated');
		await waitFor(() => {
			expect(warehouseDisplayName).toEqual('Warehouse 1 updated');
		});
	});

	test('should propagate the update to the db itself', async () => {
		const db = newTestDB();
		const note = await db.warehouse().note().create();
		const ndn$ = createDisplayNameStore(note);

		// Update to the displayName store should get propagated to the db
		ndn$.set('Note 1 updated');
		await waitFor(async () => {
			const { displayName } = (await note.get()) || {};
			expect(displayName).toEqual('Note 1 updated');
		});
	});

	test("should update the 'internalStateStore' (if provided) with the temp 'saving' state", async () => {
		const db = newTestDB();
		const note = await db.warehouse().note().create();
		const is$ = writable<NoteAppState>(NoteState.Draft);
		const ndn$ = createDisplayNameStore(note, is$);

		// Update to the displayName store should get propagated to the db
		ndn$.set('Note 1 updated');
		expect(get(is$)).toEqual(NoteTempState.Saving);
	});

	test("should not explode if 'entity' is not provided", async () => {
		const ndn$ = createDisplayNameStore(undefined);
		let noteDisplayName: string | undefined;
		ndn$.subscribe((ndn) => (noteDisplayName = ndn));
		expect(noteDisplayName).toEqual('');
	});
});
