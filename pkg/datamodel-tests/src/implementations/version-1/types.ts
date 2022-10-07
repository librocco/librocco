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
	_rev: string;
	books: VolumesByISBN;
	committed: boolean;
};
export type NoteInterface = NI<AdditionalData>;
export type NoteData = PickPartial<ND<AdditionalData>, 'books' | 'committed' | '_rev'>;
export type WarehouseInterface = WI<NoteInterface>;
export type DatabaseInterface = DI<NoteInterface>;
