import { BookEntry, DatabaseInterface, PrinterInterface } from "@/types";

type PrinterConfig = {
	labelPrinterUrl: string;
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
}

// #region label-printer
const newLabelPrinter = (printer: Printer) => {
	const print = (bookData: BookEntry) => {
		const baseUrl = printer.config.labelPrinterUrl;
		return printBookLabel(bookData!, baseUrl);
	};

	return { print };
};

const printBookLabel = (book: BookEntry, url: string) => {
	const body = JSON.stringify(Object.fromEntries(Object.entries(book).map(([k, v]) => [camelToSnake(k), v])));
	const request = new Request(url, { method: "POST", body });
	return fetch(request);
};

const camelToSnake = (camel: string) => camel.replaceAll(/[a-z][A-Z]/g, (s) => `${s[0]}_${s[1].toLowerCase()}`);
// #endregion label-printer

export const newPrinter = (db: DatabaseInterface, config: PrinterConfig) => new Printer(db, config);
