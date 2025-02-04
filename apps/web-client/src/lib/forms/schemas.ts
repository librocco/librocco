import { z } from "zod";
import type { Infer } from "sveltekit-superforms";

export type SettingsSchema = Infer<typeof settingsSchema>;
export const settingsSchema = z.object({
	couchUrl: z.string(),
	labelPrinterUrl: z.string(),
	receiptPrinterUrl: z.string()
});

export type WarehouseFormSchema = Infer<typeof warehouseSchema>;
export const warehouseSchema = z.object({
	id: z.number(),
	name: z.string(),
	discount: z.number()
});

export type WarehouseDeleteFormSchema = Infer<ReturnType<typeof warehouseDeleteSchema>>;
export const warehouseDeleteSchema = (matchConfirmation: string) => {
	const reg = new RegExp("^" + matchConfirmation + "$");
	return z.object({
		confirmation: z.string().regex(reg)
	});
};

export type DatabaseCreateFormSchema = Infer<typeof databaseCreateSchema>;
const dbNameRegex = /^[a-zA-Z0-9._]+$/;
export const databaseCreateSchema = z.object({
	name: z.string().regex(dbNameRegex, "Invalid name, please use the combination of alphanumeric characters or '_', '/', '.'")
});

export type DatabaseDeleteFormSchema = Infer<ReturnType<typeof databaseDeleteSchema>>;
export const databaseDeleteSchema = (matchConfirmation: string) => {
	const reg = new RegExp("^" + matchConfirmation + "$");
	return z.object({
		confirmation: z.string().regex(reg)
	});
};

export type BookFormSchema = Infer<typeof bookSchema>;
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

export type CustomItemFormSchema = Infer<typeof customItemSchema>;
export const customItemSchema = z.object({
	id: z.number().optional(),
	title: z.string(),
	price: z.number()
});

export type ScannerSchema = Infer<typeof scannerSchema>;
export const scannerSchema = z.object({
	isbn: z.string()
});

export type CustomerOrderSchema = Infer<ReturnType<typeof createCustomerOrderSchema>>;
export const createCustomerOrderSchema = (kind: "create" | "update") => {
	const isUpdate = kind === "update";
	const displayId = isUpdate ? z.string() : z.string().optional();
	return z.object({
		id: z.number(),
		displayId,
		fullname: z.string().default(""),
		email: z.string().email().optional(),
		deposit: z.number().default(0)
	});
};
