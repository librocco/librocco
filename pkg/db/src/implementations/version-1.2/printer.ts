import { BookEntry, DatabaseInterface, PrinterInterface, ReceiptData, ReceiptItem } from "@/types";

type PrinterConfig = {
	labelPrinterUrl: string;
	receiptPrinterUrl: string;
};

class Printer implements PrinterInterface {
	#db: DatabaseInterface;

	config: PrinterConfig;

	constructor(db: DatabaseInterface, config: PrinterConfig) {
		this.#db = db;
		this.config = config;
	}

	label() {
		return newLabelPrinter(this);
	}

	receipt() {
		return newReceiptPrinter(this);
	}
}

// #region label-printer
const newLabelPrinter = (printer: Printer) => {
	const print = (bookData: BookEntry) => {
		const url = printer.config.labelPrinterUrl;
		return postPrint(bookData!, url);
	};

	return { print };
};

const newReceiptPrinter = (printer: Printer) => {
	const print = (items: ReceiptItem[]) => {
		const timestamp = Date.now();
		const url = printer.config.receiptPrinterUrl; // TODO
		return postPrint({ items, timestamp }, url);
	};

	return { print };
};

const postPrint = (data: BookEntry | ReceiptData, url: string) => {
	const body = JSON.stringify(Object.fromEntries(Object.entries(data).map(([k, v]) => [camelToSnake(k), v])));
	const request = new Request(url, { method: "POST", body });
	return fetch(request);
};

const camelToSnake = (camel: string) => camel.replaceAll(/[a-z][A-Z]/g, (s) => `${s[0]}_${s[1].toLowerCase()}`);
// #endregion label-printer

export const newPrinter = (db: DatabaseInterface, config: PrinterConfig) => new Printer(db, config);
