import { NoteData, NoteStream, NoteType, ReceiptData, VolumeStockClient } from "@/types";
import { InventoryDatabaseInterface, NoteInterface } from "./types";

import { uniqueTimestamp } from "@/utils/misc";

class Note implements NoteInterface {
	#db: InventoryDatabaseInterface;

	id: string;
	warehouseId: string;

	noteType: NoteType;

	displayName = "";
	defaultWarehouse = "";

	committed = false;
	reconciliationNote = false;

	createdAt: string | null = null;
	updatedAt: string | null = null;
	committedAt: string | null = null;

	constructor(db: InventoryDatabaseInterface, warehouseId: string, id?: string) {
		this.#db = db;

		this.id = id || uniqueTimestamp();
		this.warehouseId = warehouseId;

		this.noteType = warehouseId === "all" ? "outbound" : "inbound";
	}

	private async _getNameSeq(): Promise<number> {
		const conn = await this.#db._db.connection;
		const res = await conn
			.selectFrom("notes as n")
			.where("n.displayName", "like", "New Note%")
			.orderBy("n.displayName", "desc")
			.select("n.displayName")
			.executeTakeFirst();

		if (!res) return 1;

		if (res.displayName === "New Note") return 2;

		return parseInt(res.displayName.match(/\([0-9]+\)/)[0].replace(/[()]/g, "")) + 1;
	}

	private async _update({ committed, reconciliationNote, ...data }: Partial<NoteData>): Promise<NoteInterface> {
		if (committed !== undefined) data["committed"] = Number(committed);
		if (reconciliationNote !== undefined) data["committed"] = Number(committed);

		// No updates to committed notes
		await this.get();
		if (this.committed) return this;

		await this.#db._db.update((db) => db.updateTable("notes").set(data).where("id", "==", this.id).execute());

		return this.get();
	}

	async create(): Promise<NoteInterface> {
		await this.#db.warehouse(this.warehouseId).create();

		const seq = await this._getNameSeq();
		const displayName = seq === 1 ? "New Note" : `New Note (${seq})`;

		await this.#db._db.update((db) =>
			db
				.insertInto("notes")
				.values({
					id: this.id,
					warehouseId: this.warehouseId,
					noteType: this.noteType,
					displayName,
					defaultWarehouse: this.defaultWarehouse
				})
				.onConflict((oc) => oc.doNothing())
				.execute()
		);
		return this.get();
	}

	async get(): Promise<NoteInterface | undefined> {
		const conn = await this.#db._db.connection;
		const res = await conn.selectFrom("notes").where("id", "==", this.id).selectAll().executeTakeFirst();

		if (!res) return undefined;

		const { committed, reconciliationNote, ...rest } = res;
		return Object.assign(this, rest, { committed: !!committed, reconciliationNote: !!reconciliationNote });
	}

	// TODO
	async delete(): Promise<void> {
		return;
	}

	// TODO
	async getEntries(): Promise<VolumeStockClient[]> {
		return [];
	}

	async setName(_: any, displayName: string): Promise<NoteInterface> {
		return this._update({ displayName });
	}

	// TODO
	async setReconciliationNote(_: any, value: boolean): Promise<NoteInterface> {
		this.reconciliationNote = value;
		return this;
	}

	// TODO
	async setDefaultWarehouse(_: any, warehouseId: string): Promise<NoteInterface> {
		this.defaultWarehouse = warehouseId;
		return this;
	}

	// TODO
	async addVolumes(): Promise<NoteInterface> {
		return this;
	}

	// TODO
	async updateTransaction(): Promise<NoteInterface> {
		return this;
	}

	// TODO
	async removeTransactions(): Promise<NoteInterface> {
		return this;
	}

	commit(): Promise<NoteInterface> {
		const updatedAt = new Date().toISOString();
		const committedAt = updatedAt;

		return this._update({ committed: true, updatedAt, committedAt });
	}

	// TODO
	async intoReceipt(): Promise<ReceiptData> {
		return { timestamp: Date.now(), items: [] };
	}

	// TODO
	async reconcile(): Promise<NoteInterface> {
		return this;
	}

	stream(): NoteStream {
		return {} as NoteStream;
	}
}

export const createNoteInterface = (db: InventoryDatabaseInterface, warehouseId: string, id?: string): NoteInterface =>
	new Note(db, warehouseId, id);
