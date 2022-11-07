import { expect, test, describe, vi } from 'vitest';
import { get } from 'svelte/store';

import { page } from './mockPage';

import allBooks from '../books';

import note1 from '../notes/note-001.json';
import note2 from '../notes/note-002.json';
import note3 from '../notes/note-003.json';

import jazz from '../warehouses/jazz.json';

import { createTableContentStore } from '../stores';

const pickIsbnQuantity = ({ isbn, quantity }: { isbn: string; quantity: number }) => ({
	isbn,
	quantity
});

describe('Test table content store', () => {
	vi.mock('$app/stores', async () => {
		const { page } = await import('./mockPage');
		return {
			page
		};
	});

	test('should derive from appropriate store for content type', () => {
		// Test 'inbound' note content
		const inNoteStore = createTableContentStore('inbound');
		page.set({ params: { id: 'note-001' } });
		expect(get(inNoteStore).map(pickIsbnQuantity)).toEqual(note1.entries.map(pickIsbnQuantity));

		// Test 'outbound' note content
		const outNoteStore = createTableContentStore('outbound');
		page.set({ params: { id: 'note-002' } });
		expect(get(outNoteStore).map(pickIsbnQuantity)).toEqual(note2.entries.map(pickIsbnQuantity));

		// Test 'outbound' note content
		const warehouseStore = createTableContentStore('stock');
		page.set({ params: { id: 'jazz' } });
		expect(get(warehouseStore).map(pickIsbnQuantity)).toEqual(jazz.entries.map(pickIsbnQuantity));
	});

	test('should show full book data in returned rows', () => {
		const inNoteStore = createTableContentStore('inbound');
		page.set({ params: { id: 'note-001' } });

		const wantRows = note1.entries.map(({ isbn, quantity }) => ({
			...allBooks[isbn],
			quantity,
			isbn
		}));

		expect(get(inNoteStore)).toEqual(wantRows);
	});

	test('should react to changes in page store', () => {
		const inNoteStore = createTableContentStore('inbound');

		page.set({ params: { id: 'note-001' } });
		expect(get(inNoteStore).map(pickIsbnQuantity)).toEqual(note1.entries.map(pickIsbnQuantity));

		page.set({ params: { id: 'note-003' } });
		expect(get(inNoteStore).map(pickIsbnQuantity)).toEqual(note3.entries.map(pickIsbnQuantity));
	});

	test("should return a empty array if no 'id' param or note not found", () => {
		const inNoteStore = createTableContentStore('inbound');

		// Test for no 'id' param
		page.set({ params: {} });
		expect(get(inNoteStore)).toEqual([]);

		// Test for non existing note
		page.set({ params: { id: 'non-existing-note' } });
		expect(get(inNoteStore)).toEqual([]);
	});
});
