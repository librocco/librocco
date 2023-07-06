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
		outOfPrint: false,
		warehouseId: "wh1",
		warehouseName: "Warehouse 1"
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
		outOfPrint: false,
		warehouseId: "wh1",
		warehouseName: "Warehouse 1"
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
		outOfPrint: false,
		warehouseId: "wh1",
		warehouseName: "Warehouse 1"
	}
];

export const availableWarehouses = new Map([
	["wh1", { displayName: "Warehouse 1" }],
	["wh2", { displayName: "Warehouse 2" }]
]);

/**
 * Includes three rows, with the first and the second row having the warehouse set up and third having it empty
 */
export const outNoteRows = rows.map((r, i) => {
	const { label: warehouseName, value: warehouseId } = availableWarehouses[i] || { label: "", value: "" };
	return { ...r, warehouseName, warehouseId, availableWarehouses } as OutNoteTableData;
});
