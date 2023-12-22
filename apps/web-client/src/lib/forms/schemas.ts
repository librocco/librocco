import { z } from "zod";
import type { SuperValidated } from "sveltekit-superforms";

export type WarehouseFormData = SuperValidated<typeof warehouseSchema>["data"];
export const warehouseSchema = z.object({
	id: z.string(),
	name: z.string(),
	discount: z.number()
});
