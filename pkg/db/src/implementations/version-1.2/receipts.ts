import type { PrintJob, ReceiptData, RecepitsInterface } from "@/types";
import type { DatabaseInterface, NoteData } from "./types";

import { DocType, PrintJobStatus } from "@/enums";

import { uniqueTimestamp, versionId } from "@/utils/misc";
import { wrapIter } from "@librocco/shared";

class Receipts implements RecepitsInterface {
	#db: DatabaseInterface;

	// TODO: Printer id could be optional - if no ID, the printer is not registered, noop
	#id: string;

	constructor(db: DatabaseInterface, printerId: string) {
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
		const books = await this.#db.books().get(entries.map(({ isbn }) => isbn));
		const items = wrapIter(entries)
			.zip(books)
			.map(([{ isbn, quantity }, { title, price } = { title: "", price: 0 }]) => ({ isbn, title, quantity, price }))
			.array();
		// In order to produce a correct total (two decimal places), we're doing the arithmetic over interegs and converting the result
		// back to a float with two decimal places. This is to avoid floating point errors.
		const total = items.reduce((acc, { quantity, price }) => acc + quantity * Math.floor(price * 100), 0) / 100;

		const printJob = this.constructPrintJob({ items, total, timestamp });

		await this.#db._pouch.put(printJob);

		return printJob._id;
	}
}

export const newReceiptsInterface = (db: DatabaseInterface, printerId: string): RecepitsInterface => new Receipts(db, printerId);
