/* eslint-disable @typescript-eslint/no-explicit-any */
// #region utils

/**
 * A convenience type used to make the type optional
 */
export type Maybe<T> = T | undefined;
/**
 * Used to make one or more properties on the object optional.
 */
export type PickPartial<R extends Record<string, any>, K extends keyof R> = Omit<R, K> &
	Partial<Pick<R, K>>;

// #endregion utils

// #region Note
export type NoteType = 'inbound' | 'outbound';

export type VolumeQuantityTuple = [string, number];

export type Database = Record<string, any>;

export interface NoteProto<A extends Record<string, any> = Record<string, any>> {
	addVolumes(...params: VolumeQuantityTuple | VolumeQuantityTuple[]): Promise<NoteInterface<A>>;
	setVolumeQuantity(isbn: string, quantity: number): Promise<NoteInterface<A>>;
	delete(): Promise<void>;
	commit(): Promise<NoteInterface<A>>;
}
export type NoteData<A extends Record<string, any> = Record<string, any>> = {
	_id: string;
	type: NoteType;
} & A;

export type NoteInterface<A extends Record<string, any> = Record<string, any>> = NoteProto<A> &
	NoteData<A>;
// #endregion Note

// #region Warehouse
export interface WarehouseProto<
	N extends NoteInterface<any> = NoteInterface,
	S extends Record<string, any> = Record<string, any>
> {
	createInNote(): Promise<N>;
	createOutNote(): Promise<N>;
	getNotes(): Promise<N[]>;
	getNote(id: string): Promise<N>;
	updateNote(note: N): Promise<N>;
	deleteNote(note: N): Promise<void>;
	getStock(): Promise<S>;
}
export type WarehouseData<A extends Record<string, any> = Record<string, any>> = {
	name: string;
} & A;

export type WarehouseInterface<
	N extends NoteInterface,
	S extends Record<string, any> = Record<string, any>,
	D extends Record<string, any> = Record<string, any>
> = WarehouseProto<NoteInterface<N>, S> & WarehouseData<D>;
// #endregion warehouse
