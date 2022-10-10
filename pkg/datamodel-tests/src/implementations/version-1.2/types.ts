import {
	PickPartial,
	NoteInterface as NI,
	NoteData as ND,
	WarehouseInterface as WI,
	DatabaseInterface as DI,
	CouchDocument,
	VolumeStock
} from '@/types';

export type TransactionDocument = CouchDocument<VolumeStock & { committed?: boolean }>;
export type AdditionalMethods = {
	updateRev: (rev: string) => NoteInterface;
};
export type AdditionalData = {
	/**
	 * A list of all volume transactions in the note,
	 * each transaction represented by a tuple of [transactionId, _rev].
	 */
	transactions: [string, string][];
};
export type NoteInterface = NI<AdditionalMethods & AdditionalData>;
export type NoteData = PickPartial<ND, 'committed' | 'books'>;
export type WarehouseInterface = WI<NoteInterface>;
export type DatabaseInterface = DI<NoteInterface>;
