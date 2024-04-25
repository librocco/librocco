import { wrapIter } from "@librocco/shared";

import type { PrintJob, ReceiptData, RecepitsInterface } from "@/types";
import type { InventoryDatabaseInterface, NoteData } from "./types";

import { DocType, PrintJobStatus } from "@/enums";

import { uniqueTimestamp } from "@/utils/misc";
import { versionId } from "./utils";

class Receipts implements RecepitsInterface {
	#db: InventoryDatabaseInterface;

	// TODO: Printer id could be optional - if no ID, the printer is not registered, noop
	#id: string;

	constructor(db: InventoryDatabaseInterface, printerId: string) {
		this.#db = db;
		this.#id = printerId;
	}

	private constructPrintJob(receipt: ReceiptData): PrintJob {
		const _id = versionId(`print_queue/${this.#id}/${uniqueTimestamp()}`);
		return {
			...receipt,
			_id,
			docType: DocType.PrintJob,
			// TODO: Find a way to get the correct printer id
			printer_id: this.#id,
			status: PrintJobStatus.Pending
		};
	}

	async print({ entries }: NoteData): Promise<string> {
		const timestamp = Number(new Date());

		const [books, warehouseMap] = await Promise.all([
			this.#db.books().get(entries.map(({ isbn }) => isbn)),
			this.#db.getWarehouseDataMap()
		]);

		const items = wrapIter(entries)
			// Add warehouse discount to each entry
			.map(({ warehouseId, ...entry }) => ({ ...entry, discount: warehouseMap.get(warehouseId)?.discountPercentage ?? 0 }))
			// Zip with book data res - we can safely do this as the length and ordering of isbns and book data is the same (with undefined for missing books)
			.zip(books)
			.map(([stock, { title, price } = { title: "", price: 0 }]) => ({ ...stock, title, price }))
			.array();

		const printJob = this.constructPrintJob({ items, timestamp });

		await this.#db._pouch.put(printJob);

		return printJob._id;
	}
}

export const newReceiptsInterface = (db: InventoryDatabaseInterface, printerId: string): RecepitsInterface => new Receipts(db, printerId);
