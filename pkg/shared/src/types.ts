// #region misc
export type VolumeStockKind = "book" | "custom";

/* eslint-disable @typescript-eslint/ban-types */
/**
 * A union of entries found in note and warehouse's `entries` (`"custom"` variant should only be found in outbond notes).
 * The union can be descriminated over the `__kind` property.
 */
export type VolumeStock<K extends VolumeStockKind = VolumeStockKind> = K extends "book"
	? {
			__kind?: "book";
			isbn: string;
			quantity: number;
			warehouseId: string;
		}
	: {
			__kind: "custom";
			id: string;
			title: string;
			price: number;
		};

// #region DB
export type BookData = {
	isbn: string;
	title?: string;
	price?: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	category?: string;
};
