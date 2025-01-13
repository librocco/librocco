import { z } from "zod";
import type { Infer } from "sveltekit-superforms";

export type SettingsSchema = Infer<typeof settingsSchema>;
export const settingsSchema = z.object({
	couchUrl: z.string(),
	labelPrinterUrl: z.string(),
	receiptPrinterUrl: z.string()
});
