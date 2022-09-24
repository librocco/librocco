import { CouchDocument, RawBookStock } from '../../types';

// #region types
export type NoteType = 'in-note' | 'out-note';

export type BookStock = CouchDocument<Pick<RawBookStock, 'quantity' | 'warehouse'>>;
export type Stock = CouchDocument<{ books: BookStock[] }>;
export type Note = Stock & { type: NoteType };
// #endregion types
