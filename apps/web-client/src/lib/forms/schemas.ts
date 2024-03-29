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

export type BookFormData = SuperValidated<typeof bookSchema>["data"];
export const bookSchema = z.object({
	isbn: z.string(),
	title: z.string(),
	price: z.number(),
	year: z.string().optional(),
	authors: z.string().optional(),
	publisher: z.string().optional(),
	editedBy: z.string().optional(),
	outOfPrint: z.boolean().optional()
});

export type RemoteDbData = SuperValidated<typeof remoteDbSchema>["data"];
export const remoteDbSchema = z.object({
	url: z.string(),
	direction: z.enum(["to", "from", "sync"]).default("sync"),
	live: z.boolean().default(true),
	retry: z.boolean().default(true)
});

export type ScannerData = SuperValidated<typeof scannerSchema>["data"];
export const scannerSchema = z.object({
	isbn: z.string()
});
