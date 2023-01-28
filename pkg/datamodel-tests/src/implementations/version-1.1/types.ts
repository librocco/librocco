import {
	PickPartial,
	NoteInterface as NI,
	NoteData as ND,
	WarehouseInterface as WI,
	DatabaseInterface as DI,
	VolumeStock
} from '@/types';

export type AdditionalData = {
	books: VolumeStock[];
};
export type AdditoinalMethods = {
	updateRev: (rev: string) => NoteInterface;
};
export type NoteInterface = NI<AdditionalData & AdditoinalMethods>;
export type NoteData = PickPartial<ND<AdditionalData>, 'books' | 'committed'>;
export type WarehouseInterface = WI<NoteInterface>;
export type DatabaseInterface = DI<NoteInterface>;
