import type { InventoryTableData } from "$lib/components/Tables/types";

export const rows: InventoryTableData<"book">[] = [
	{
		isbn: "917289012390",
		title: "Miti Del Nord",
		authors: "Neil Gaiman",
		quantity: 3,
		price: 10000,
		publisher: "Mondadori",
		year: "2017",
		editedBy: "",
		outOfPrint: false,
		warehouseId: "wh1",
		warehouseName: "Warehouse 1",
		warehouseDiscount: 20
	},
	{
		isbn: "917289012381",
		title: "Hellenistic history and culture",
		authors: "Peter Green",
		quantity: 3,
		price: 100,
		publisher: "Penguin",
		year: "2017",
		editedBy: "",
		outOfPrint: false,
		warehouseId: "wh1",
		warehouseName: "Warehouse 1",
		warehouseDiscount: 10
	},

	{
		isbn: "917289012323",
		title: "Studies in Greek culture and Roman policy, and other topics that you may study if you pursued a PhD in Hellianc culture",
		authors: "Robert Lamberton, Fausto Lanzoni, Doriana Rodino, Carlo Tabacchi, Giuseppe Vottari",
		quantity: 3,
		price: 10,
		publisher: "A very long publisher name. Like super long. Longer than acceptable.",
		year: "2017",
		editedBy: "Renato Sironi, Francesca Desiderio, Evelina Poggi, Allesandro Lucchese",
		outOfPrint: false,
		warehouseId: "wh1",
		warehouseName: "Warehouse 1",
		warehouseDiscount: 0
	}
];

export const availableWarehouses = new Map([
	["wh1", { displayName: "Warehouse 1", quantity: 1 }],
	["wh2", { displayName: "Warehouse 2", quantity: 1 }]
]);

/**
 * Includes three rows, with the first and the second row having the warehouse set up and third having it empty
 */
export const outNoteRows = rows.map((r, i) => {
	const { label: warehouseName, value: warehouseId } = availableWarehouses[i] || { label: "", value: "" };
	return { ...r, warehouseName, warehouseId, availableWarehouses } as InventoryTableData<"book">;
});
