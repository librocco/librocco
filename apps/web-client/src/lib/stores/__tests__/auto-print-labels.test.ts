import { get } from "svelte/store";
import { afterEach, describe, expect, it } from "vitest";

import { getAutoPrintLabelsStore, removeAutoPrintLabelsSetting } from "$lib/stores/app";
import { LOCAL_STORAGE_AUTO_PRINT_LABELS } from "$lib/constants";

const storageKey = (noteId: number) => `${LOCAL_STORAGE_AUTO_PRINT_LABELS}:${noteId}`;

// NOTE: svelte-local-storage-store caches stores per key in a module-level map, so the cache survives across tests.
// Each test uses its own note id(s) to stay independent; localStorage is cleaned up after each test.
const usedNoteIds: number[] = [];
let nextNoteId = 910_000;
const freshNoteId = () => {
	const id = nextNoteId++;
	usedNoteIds.push(id);
	return id;
};

describe("auto-print-labels store", () => {
	afterEach(() => {
		while (usedNoteIds.length) {
			removeAutoPrintLabelsSetting(usedNoteIds.pop());
		}
	});

	it("keeps stores for different note ids independent", () => {
		const noteA = freshNoteId();
		const noteB = freshNoteId();

		const storeA = getAutoPrintLabelsStore(noteA);
		const storeB = getAutoPrintLabelsStore(noteB);

		storeA.set(true);

		expect(get(storeA)).toBe(true);
		expect(get(storeB)).toBe(false);
		expect(localStorage.getItem(storageKey(noteA))).toBe("true");
		expect(localStorage.getItem(storageKey(noteB))).toBe(null);

		storeA.toggle();
		expect(get(storeA)).toBe(false);
		expect(get(storeB)).toBe(false);
	});

	it("removeAutoPrintLabelsSetting resets both localStorage and the live (cached) store value", () => {
		const noteId = freshNoteId();

		const store = getAutoPrintLabelsStore(noteId);
		let current: boolean;
		const unsubscribe = store.subscribe((value) => (current = value));

		store.set(true);
		expect(current).toBe(true);
		expect(localStorage.getItem(storageKey(noteId))).toBe("true");

		removeAutoPrintLabelsSetting(noteId);

		// The localStorage key is gone...
		expect(localStorage.getItem(storageKey(noteId))).toBe(null);
		// ...AND the in-memory (cached) store was reset: a same-tab removeItem fires no storage event and the
		// library's subscribe-time hydration only overwrites the value when getItem returns non-null, so without
		// an explicit reset the cached writable would keep holding `true`
		expect(current).toBe(false);
		expect(get(getAutoPrintLabelsStore(noteId))).toBe(false);

		unsubscribe();
	});

	it("a store re-obtained for the same (recycled) note id after removal reads false", () => {
		const noteId = freshNoteId();

		// Simulate a note with auto-print ON being committed/deleted...
		getAutoPrintLabelsStore(noteId).set(true);
		removeAutoPrintLabelsSetting(noteId);

		// ...and a new note recycling the same id (note ids are MAX(id) + 1, deletes are hard deletes)
		const reobtained = getAutoPrintLabelsStore(noteId);

		expect(get(reobtained)).toBe(false);
		expect(localStorage.getItem(storageKey(noteId))).toBe(null);
	});
});
