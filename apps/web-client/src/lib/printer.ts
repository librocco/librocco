import type { BookData } from "@librocco/shared";

import type { ReceiptData } from "$lib/db/types";

const postPrint = <D extends BookData | ReceiptData>(url: string, data: D) => {
	const body = JSON.stringify(Object.fromEntries(Object.entries(data).map(([k, v]) => [camelToSnake(k), v])));
	const request = new Request(url, { method: "POST", body });
	return fetch(request);
};

export const printBookLabel = postPrint<BookData>;
export const printReceipt = postPrint<ReceiptData>;

const camelToSnake = (camel: string) => camel.replaceAll(/[a-z][A-Z]/g, (s) => `${s[0]}_${s[1].toLowerCase()}`);
