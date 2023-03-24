import {
	DatabaseInterface as DI,
	WarehouseInterface as WI,
	WarehouseData as WD,
	NoteInterface as NI,
	NoteData as ND,
	VolumeStock
} from "@/types";

/** Both the warehouse and note have additional `entries` field in this implementation */
export type AdditionalData = {
	entries: VolumeStock[];
};

/** Note data (extended with additional fields) for internal implementation usage. */
export type NoteData = ND<AdditionalData>;
export type NoteInterface = NI<AdditionalData>;

/** Warehouse data (extended with additional fields) for internal implementation usage. */
export type WarehouseData = WD;
export type WarehouseInterface = WI<NoteInterface>;

export type DatabaseInterface = DI<WarehouseInterface, NoteInterface>;

export type WarehouseListViewResp = {
	key: string;
	value: { displayName?: string };
};
export type NoteListViewResp = {
	key: string;
	value: { displayName?: string; committed?: boolean };
};
