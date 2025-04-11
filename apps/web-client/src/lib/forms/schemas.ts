import { z } from "zod";
import type { Infer } from "sveltekit-superforms";

export type DeviceSettingsSchema = Infer<typeof deviceSettingsSchema>;
export const deviceSettingsSchema = z.object({
	labelPrinterUrl: z.string(),
	receiptPrinterUrl: z.string()
});

export type SyncSettingsSchema = Infer<typeof syncSettingsSchema>;
export const syncSettingsSchema = z.object({
	dbid: z.string().min(1),
	url: z.string()
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
const dbidRegex = /^[a-zA-Z0-9._]+$/;
export const databaseCreateSchema = z.object({
	name: z.string().regex(dbidRegex, "Invalid name, please use the combination of alphanumeric characters or '_', '/', '.'")
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
	const displayId = isUpdate ? z.string().min(1) : z.string().optional();
	return z.object({
		id: z.number(),
		displayId,
		fullname: z.string().min(1),
		email: z.string().max(0).optional().or(z.string().email()),
		deposit: z.number().default(0)
	});
};

export type SupplierSchema = Infer<typeof supplierSchema>;
export const supplierSchema = z.object({
	id: z.number(),
	name: z.string().min(1),
	email: z.string().max(0).optional().or(z.string().email().optional()),
	address: z.string().optional()
});
