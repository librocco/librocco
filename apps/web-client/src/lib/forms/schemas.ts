import { z } from "zod";
import type { SuperValidated } from "sveltekit-superforms";

export type WarehouseFormData = SuperValidated<typeof warehouseSchema>["data"];
export const warehouseSchema = z.object({
	id: z.string(),
	name: z.string(),
	discount: z.number()
});

export type WarehouseDeleteFormData = SuperValidated<ReturnType<typeof warehouseDeleteSchema>>["data"];
export const warehouseDeleteSchema = (matchConfirmation: string) => {
	const reg = new RegExp("^" + matchConfirmation + "$");
	return z.object({
		confirmation: z.string().regex(reg)
	});
};

export type DatabaseCreateFormData = SuperValidated<typeof databaseCreateSchema>["data"];
const dbNameRegex = /^[a-zA-Z0-9._]+$/;
export const databaseCreateSchema = z.object({
	name: z.string().regex(dbNameRegex, "Invalid name, please use the combination of alphanumeric characters or '_', '/', '.'")
});

export type DatabaseDeleteFormData = SuperValidated<ReturnType<typeof databaseDeleteSchema>>["data"];
export const databaseDeleteSchema = (matchConfirmation: string) => {
	const reg = new RegExp("^" + matchConfirmation + "$");
	return z.object({
		confirmation: z.string().regex(reg)
	});
};

export type BookFormData = SuperValidated<typeof bookSchema>["data"];
export const bookSchema = z.object({
	isbn: z.string(),
	title: z.string(),
	price: z.number(),
	year: z.string().optional(),
	authors: z.string().optional(),
	publisher: z.string().optional(),
	editedBy: z.string().optional(),
	outOfPrint: z.boolean().optional(),
	category: z.string().optional()
});

export type SettingsData = SuperValidated<typeof settingsSchema>["data"];
export const settingsSchema = z.object({
	couchUrl: z.string(),
	labelPrinterUrl: z.string(),
	receiptPrinterUrl: z.string()
});

export type CustomItemFormData = SuperValidated<typeof customItemSchema>["data"];
export const customItemSchema = z.object({
	id: z.string().optional(),
	title: z.string(),
	price: z.number()
});

export type ScannerData = SuperValidated<typeof scannerSchema>["data"];
export const scannerSchema = z.object({
	isbn: z.string()
});

export type customerOrderData = SuperValidated<typeof customerOrderSchema>["data"];
export const customerOrderSchema = z.object({
	id: z.number(),
	fullname: z.string(),
	deposit: z.number()
});
