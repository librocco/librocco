import {
	PickPartial,
	NoteInterface as NI,
	NoteData as ND,
	WarehouseInterface as WI,
	DatabaseInterface as DI,
	VolumeStock,
	CouchDocument
} from '@/types';

export type AdditionalData = {
	_rev: string;
	books: CouchDocument<VolumeStock>[];
};
export type NoteInterface = NI<AdditionalData>;
export type NoteData = PickPartial<ND<AdditionalData>, 'books' | 'committed' | '_rev'>;
export type WarehouseInterface = WI<NoteInterface>;
export type DatabaseInterface = DI<NoteInterface>;
