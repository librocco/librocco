/**
 * @TODO This is a temporary file to be replaced with a real db (in index.ts of this folder).
 * This file is here only so the current app doesn't break.
 */

import { derived } from "svelte/store";

import { NoteState } from "@librocco/shared";

import type { DbInterface, DbStream, NavListEntry, Stores } from "$lib/types/db";

import { newWarehouse } from "./warehouse";

import { derivedObservable, observableFromStore } from "$lib/utils/streams";

import { warehouseStore, inNoteStore, outNoteStore, noteLookup } from "./data";

const defaultStores = {
	warehouseStore,
	inNoteStore,
	outNoteStore
};

/**
 * Creates an interface for db operations. Accepts optional stores argument to override the default store(s).
 * If not provided, falls back to the default stores. If provided partially, only the provided stores will be overridden.
 * @param overrideStores (optional) partial stores to override
 * @returns
 */
export const db = (overrideStores: Partial<Stores> = {}): DbInterface => {
	const stores = { ...defaultStores, ...overrideStores };

	const { warehouseStore } = stores;

	const warehouse = (id = "all") => newWarehouse(stores)(id);

	const stream = (): DbStream => ({
		warehouseList: derivedObservable(warehouseStore, ($warehouseStore) =>
			Object.entries($warehouseStore).map(([id, { displayName }]) => ({ id, displayName }))
		),

		inNoteList: observableFromStore(
			derived([warehouseStore, noteLookup], ([$warehouseStore, $noteLookup]) => {
				// Filter out outbound and deleted notes
				const filteredNotes = Object.values($noteLookup).filter(
					({ state, type }) => state !== NoteState.Deleted && type === "inbound"
				);
				// Group notes by warehouse adding each note to 'all' warehouse
				const groupedNotes = filteredNotes.reduce((acc, note) => {
					const { warehouse, id, displayName } = note;
					const warehouseIds = ["all", warehouse];

					warehouseIds.forEach((warehouse) => {
						if (!acc[warehouse]) acc[warehouse] = [];
						acc[warehouse].push({ id, displayName });
					});

					return acc;
				}, {} as Record<string, NavListEntry[]>);
				// Transform grouped notes into in note list
				// adding each warehouse's display name from warehouseStore
				return Object.entries(groupedNotes).map(([warehouse, notes]) => {
					const { displayName } = $warehouseStore[warehouse] || { displayName: warehouse };
					return { id: warehouse, displayName, notes };
				});
			})
		),

		outNoteList: derivedObservable(noteLookup, ($noteLookup) =>
			Object.values($noteLookup)
				// Pluck non-deleted outbound notes
				.filter(({ state, type }) => state !== NoteState.Deleted && type === "outbound")
				// Get id and displayName
				.map(({ id, displayName }) => ({ id, displayName }))
		),

		findNote: derivedObservable(noteLookup, ($noteLookup) => {
			return (noteId: string) => $noteLookup[noteId];
		})
	});

	return { warehouse, stream };
};
