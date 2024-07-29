import * as ss from "superstruct";
import { crr, primary } from "crstore";

const warehouseSchema = crr(
	primary(
		ss.object({
			id: ss.string(),
			displayName: ss.string(),
			discountPercentage: ss.number(),

			createdAt: ss.string(),
			updatedAt: ss.string()
		}),
		"id"
	)
);

const noteSchema = crr(
	primary(
		ss.object({
			id: ss.string(),
			warehouseId: ss.string(),

			noteType: ss.string(),

			committed: ss.number(),
			deleted: ss.number(),

			displayName: ss.string(),
			defaultWarehouse: ss.optional(ss.string()),
			reconciliationNote: ss.number(),

			createdAt: ss.string(),
			updatedAt: ss.string(),
			committedAt: ss.optional(ss.string())
		}),
		"id",
		"warehouseId"
	)
);

const bookTransctionSchema = crr(
	primary(
		ss.object({
			warehouseId: ss.string(),
			noteId: ss.string(),

			isbn: ss.string(),
			quantity: ss.number(),

			updatedAt: ss.string()
		}),
		"isbn",
		"noteId",
		"warehouseId"
	)
);

const customItemTransactionSchema = crr(
	primary(
		ss.object({
			noteId: ss.string(),

			id: ss.string(),
			title: ss.string(),
			price: ss.number(),

			updatedAt: ss.string()
		}),
		"id",
		"noteId"
	)
);

const bookDataSchema = crr(
	primary(
		ss.object({
			isbn: ss.string(),
			title: ss.optional(ss.string()),
			price: ss.optional(ss.number()),
			year: ss.optional(ss.string()),
			authors: ss.optional(ss.string()),
			publisher: ss.optional(ss.string()),
			editedBy: ss.optional(ss.string()),
			outOfPrint: ss.optional(ss.number()),
			category: ss.optional(ss.string()),
			updatedAt: ss.optional(ss.string())
		}),
		"isbn"
	)
);

export const schema = ss.object({
	warehouses: warehouseSchema,
	notes: noteSchema,
	bookTransactions: bookTransctionSchema,
	customItemTransactions: customItemTransactionSchema,
	books: bookDataSchema
});
