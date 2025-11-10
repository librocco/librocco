import { z } from "zod";
import type { Infer } from "sveltekit-superforms";
import { get } from "svelte/store";

import type { TranslationFunctions } from "@librocco/shared";
import LL from "@librocco/shared/i18n-svelte";

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

export type CustomerSearchSchema = Infer<typeof customerSearchSchema>;
export const customerSearchSchema = z.object({
	fullname: z.string()
});

export type CustomerOrderSchema = Infer<ReturnType<typeof createCustomerOrderSchema>>;
export const createCustomerOrderSchema = (
	existingCustomers: Array<{ displayId: string; fullname: string; bookCount: number }> = [],
	currentDisplayId?: string
) => {
	// Create a map for quick lookup
	const customerMap = new Map(existingCustomers.map((c) => [c.displayId, c]));

	// Remove current customer ID from validation if editing
	if (currentDisplayId) {
		customerMap.delete(currentDisplayId);
	}

	return z.object({
		id: z.number(),
		displayId: z
			.string()
			.min(1)
			.refine(
				(val) => !customerMap.has(val),
				(val) => {
					const existing = customerMap.get(val);
					if (!existing) {
						return {
							message: get(LL)?.forms.customer_order_meta.validation.display_id_not_unique() ?? "This customer ID is already taken"
						};
					}

					return {
						message:
							get(LL)?.forms.customer_order_meta.validation.display_id_in_use({
								fullname: existing.fullname,
								bookCount: existing.bookCount
							}) ??
							`This ID is already in use by customer "${existing.fullname}" with ${existing.bookCount} ordered book${existing.bookCount === 1 ? "" : "s"}`
					};
				}
			),
		fullname: z.string().min(1),
		email: z.string().max(0).optional().or(z.string().email()),
		deposit: z.number().default(0),
		phone1: z.string().optional(),
		phone2: z.string().optional()
	});
};

export type SupplierSchema = Infer<ReturnType<typeof supplierSchema>>;
export const supplierSchema = (LL: TranslationFunctions) =>
	z.object({
		id: z.number(),
		name: z.string().min(1),
		email: z.string().max(0).optional().or(z.string().email().optional()),
		address: z.string().optional(),
		customerId: z.number().default(0),
		orderFormat: z
			.enum(["", "PBM", "Standard", "RCS-3", "RCS-5", "Loescher-3", "Loescher-5"])
			/** @TODO not sure how to fix this, the correct type would be
			 * to use "message" instead of "error" but that results in the error not being displayed
			 * and when it is displayed, it's a generic "Input invalid" message
			 *  */
			.refine((orderFormat) => orderFormat !== "", { error: LL.forms.supplier_meta.labels.order_format_message() } as any)
	});
