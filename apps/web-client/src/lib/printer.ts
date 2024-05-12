import type { BookEntry, ReceiptData } from "@librocco/db";

const postPrint = <D extends BookEntry | ReceiptData>(url: string, data: D) => {
	const body = JSON.stringify(Object.fromEntries(Object.entries(data).map(([k, v]) => [camelToSnake(k), v])));
	const request = new Request(url, { method: "POST", body });
	return fetch(request);
};

export const printBookLabel = postPrint<BookEntry>;
export const printReceipt = postPrint<ReceiptData>;

const camelToSnake = (camel: string) => camel.replaceAll(/[a-z][A-Z]/g, (s) => `${s[0]}_${s[1].toLowerCase()}`);
