export enum NoteTempState {
	Saving = "saving",
	Committing = "committing",
	Deleting = "deleting"
}

export enum NoteState {
	Draft = "draft",
	Committed = "committed",
	Deleted = "deleted"
}

export enum CustomerOrderState {
	Draft = "draft",
	Committed = "committed"
}

/**
 * Status of the order item (a row in customer/supplier order).
 * Used a regular enum, rather than string enum as regular enums are essentially
 * ints, so it's easier to order them, take a subset, etc.
 */
export enum OrderItemStatus {
	Draft,
	Placed,
	Delivered
	// TODO: ...rest of the statuses
}
