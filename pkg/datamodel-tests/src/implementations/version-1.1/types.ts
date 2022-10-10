import {
	PickPartial,
	NoteInterface as NI,
	NoteData as ND,
	WarehouseInterface as WI,
	DatabaseInterface as DI
} from '@/types';

type QuantityPerWarehouse = {
	[warehouse: string]: number;
};
export type VolumesByISBN = {
	[isbn: string]: QuantityPerWarehouse;
};

export type AdditionalData = {
	books: VolumesByISBN;
};
export type AdditoinalMethods = {
	updateRev: (rev: string) => NoteInterface;
};
export type NoteInterface = NI<AdditionalData & AdditoinalMethods>;
export type NoteData = PickPartial<ND<AdditionalData>, 'books' | 'committed'>;
export type WarehouseInterface = WI<NoteInterface>;
export type DatabaseInterface = DI<NoteInterface>;
