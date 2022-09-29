import {
	PickPartial,
	NoteInterface as NI,
	NoteData as ND,
	WarehouseInterface as WI
} from './types';

export interface VolumeStock {
	isbn: string;
	quantity: number;
}
export type AdditionalData = { _rev: string; books: VolumeStock[]; committed: boolean };
export type NoteInterface = NI<AdditionalData>;
export type NoteData = PickPartial<ND<AdditionalData>, 'books' | 'committed' | '_rev'>;
export type WarehouseInterface = WI<NoteInterface, VolumeStock[]>;
