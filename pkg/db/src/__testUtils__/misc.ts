import { expect, vi } from "vitest";

import { VolumeStock, testUtils } from "@librocco/shared";

import { InventoryDatabaseInterface, VersionedString } from "@/types";

export type TestNote =
	| {
			type: "inbound";
			date: string;
			warehouseId: string;
			entries: VolumeStock[];
	  }
	| {
			type: "outbound";
			date: string;
			entries: VolumeStock[];
	  };

export type StockAssertion = {
	warehouseId: string;
	entries: VolumeStock<"book">[];
};

/**
 * A test util used to add notes with reduced boiler plate, and explicit date set up (avoiding mocking)
 */
export const addAndCommitNotes = async (db: InventoryDatabaseInterface, notes: TestNote[]) => {
	// Stub the system time (and Date object)
	vi.useFakeTimers();

	for (const note of notes) {
		const wh = note.type === "inbound" ? db.warehouse(note.warehouseId) : db.warehouse();

		// Mock the date so that the note is created with the desired date
		vi.setSystemTime(new Date(note.date).getTime());

		await wh
			.create()
			.then((w) => w.note().create())
			.then((n) => n.addVolumes(...note.entries))
			.then((n) => n.commit({}));
	}

	// Reset the timers after operation
	vi.useRealTimers();
};

/** A test util used to assert stock with reduced boiler plate */
export const assertStock = (db: InventoryDatabaseInterface, versionId: (x: string) => VersionedString, warehouses: StockAssertion[]) =>
	Promise.all(
		warehouses.map(({ warehouseId, entries }) => {
			const warehouse = db.warehouse(warehouseId);
			let rows = [] as VolumeStock[];
			warehouse
				.stream()
				.entries({})
				.subscribe(($r) => (rows = $r.rows));
			return testUtils.waitFor(() =>
				expect(rows).toEqual(
					entries.map(({ warehouseId, ...entry }) => expect.objectContaining({ ...entry, warehouseId: versionId(warehouseId) }))
				)
			);
		})
	);
