import type { NoteInterface } from "@librocco/db";
import { WebUSBPrinter, Printer } from "@librocco/receipt-printer";

const device = new WebUSBPrinter();
const printer = new Printer(device);

export const printReceipt = async (note?: NoteInterface) => {
	if (!note) return;
	const { items, total, timestamp } = await note.getReceiptData();
	printer.font("A").align("RT").text(`no: ${timestamp}`).println("");

	printer.table(["Title", "Price", "Total"]);
	printer.newLine();
	for (const item of items) {
		const title = item.title.slice(0, 12);

		// We're allowing for up to 3 digit quantities
		const quantityStr = fixedStr(item.quantity.toString(), 3);
		const priceStr = item.price.toFixed(2);
		// 3 characters quantity, + 3 characters for " x ", + 6 characters for price (including decimal point)
		const price = fixedStr(`${priceStr} x ${quantityStr}`, 12);

		const total = fixedStr((item.price * item.quantity).toFixed(2), 7);

		printer.table([title, price, total]);
	}

	printer.newLine();
	printer.style("BI");
	printer.table(["", "Total", fixedStr(total.toString(), 7)]);
	printer.style("NORMAL");
	printer.starFullCut().cut();

	return printer.close();
};

const fixedStr = (str: string, len: number) => str.padStart(len, " ");
