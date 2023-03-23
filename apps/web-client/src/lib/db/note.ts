import type { Writable } from "svelte/store";

import { NoteState } from "$lib/enums/db";

import type { NoteStore } from "$lib/types/inventory";
import type { NoteInterface, NoteStream } from "$lib/types/db";

import { derivedObservable } from "$lib/utils/streams";

export const newNote =
	(contentStore: Writable<NoteStore>) =>
	(noteId: string): NoteInterface => {
		const update = (note: Partial<NoteStore[keyof NoteStore]>) =>
			new Promise<void>((resolve) => {
				/** @TEMP Set timeout is here to simulate the async behaviour in production */
				setTimeout(() => {
					contentStore.update((store) => {
						const existingNote = store[noteId];

						// No-op if note not found
						if (!existingNote) return store;

						store[noteId] = { ...existingNote, ...note, updatedAt: new Date().toISOString() };

						return store;
					});
					resolve();
				}, 1000);
			});

		const commit = () => update({ state: NoteState.Committed });

		const deleteNote = () => update({ state: NoteState.Deleted });

		const setName = (displayName: string) => update({ displayName });

		const stream = (): NoteStream => {
			const state = derivedObservable(contentStore, ($contentStore) => {
				const note = $contentStore[noteId];
				return note ? note.state : undefined;
			});
			const displayName = derivedObservable(contentStore, ($contentStore) => {
				const note = $contentStore[noteId];
				return note?.displayName || noteId;
			});
			const updatedAt = derivedObservable(contentStore, ($contentStore) => {
				const note = $contentStore[noteId];
				return note ? new Date(note.updatedAt) : undefined;
			});
			const entries = derivedObservable(contentStore, ($contentStore) => {
				const note = $contentStore[noteId];
				return note ? note.entries : [];
			});

			return { state, displayName, updatedAt, entries };
		};

		return { commit, delete: deleteNote, setName, stream };
	};
