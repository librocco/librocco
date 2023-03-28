import type { InventoryTableData, OutNoteTableData } from "../types";

export const rows: InventoryTableData[] = [
	{
		isbn: "917289012390",
		title: "Miti Del Nord",
		authors: "Neil Gaiman",
		quantity: 3,
		price: 10,
		publisher: "Mondadori",
		year: "2017",
		editedBy: "",
		outOfPrint: false
	},
	{
		isbn: "917289012381",
		title: "Hellenistic history and culture",
		authors: "Peter Green",
		quantity: 3,
		price: 10,
		publisher: "Penguin",
		year: "2017",
		editedBy: "",
		outOfPrint: false
	},

	{
		isbn: "917289012323",
		title: "Studies in Greek culture and Roman policy",
		authors: "Robert Lamberton",
		quantity: 3,
		price: 10,
		publisher: "Penguin",
		year: "2017",
		editedBy: "",
		outOfPrint: false
	}
];

export const availableWarehouses = [
	{
		label: "Warehouse 1",
		value: "wh1"
	},
	{
		label: "Warehouse 2",
		value: "wh2"
	}
];

/**
 * Includes three rows, with the first and the second row having the warehouse set up and third having it empty
 */
export const outNoteRows = rows.map((r, i) => {
	const { label: warehouseName, value: warehouseId } = availableWarehouses[i] || { label: "", value: "" };
	return { ...r, warehouseName, warehouseId, availableWarehouses } as OutNoteTableData;
});
