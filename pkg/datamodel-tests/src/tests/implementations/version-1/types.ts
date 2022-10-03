import {
	PickPartial,
	NoteInterface as NI,
	NoteData as ND,
	WarehouseInterface as WI,
	DatabaseInterface as DI
} from '@/types';

export type AdditionalData = { _rev: string; books: Record<string, number>; committed: boolean };
export type NoteInterface = NI<AdditionalData>;
export type NoteData = PickPartial<ND<AdditionalData>, 'books' | 'committed' | '_rev'>;
export type WarehouseInterface = WI<NoteInterface>;
export type DatabaseInterface = DI<NoteInterface>;
