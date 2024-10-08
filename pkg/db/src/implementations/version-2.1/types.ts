import { Kysely, SelectQueryNode, type CompiledQuery } from "kysely";
import { Observable } from "rxjs";

import { debug } from "@librocco/shared";

import type {
	DatabaseInterface as DI,
	NoteInterface as NI,
	NoteData as ND,
	WarehouseData as WD,
	WarehouseInterface as WI,
	InventoryDatabaseInterface as IDB,
	OrdersDatabaseInterface as ODI,
	CustomerOrderInterface as COI,
	CustomerOrderData as COD
} from "@/types";

export type NoteData = ND;
export type NoteInterface = NI;

export type WarehouseData = WD;
export type WarehouseInterface = WI;

export type CustomerOrderData = COD;
export type CustomerOrderInterface = COI;

export type DatabaseSchema = {
	warehouses: {
		id: string;
		displayName: string;
		discountPercentage: number;
		createdAt: string;
		updatedAt: string;
	};

	notes: {
		id: string;
		warehouseId: string;
		noteType: string;
		committed: number;
		deleted: number;
		displayName: string;
		defaultWarehouse: string;
		reconciliationNote: number;
		createdAt: string;
		updatedAt: string;
		committedAt: string;
	};

	bookTransactions: {
		warehouseId: string;
		noteId: string;
		isbn: string;
		quantity: number;
		updatedAt: string;
	};

	customItemTransactions: {
		noteId: string;
		id: string;
		title: string;
		price: number;
		updatedAt: string;
	};

	books: {
		isbn: string;
		title: string;
		price: number;
		year: string;
		authors: string;
		publisher: string;
		editedBy: string;
		outOfPrint: number;
		category: string;
		updatedAt: string;
	};
};

/**
 * Note: the following code was shamelssly copied from the crstore library:
 * https://github.com/Azarattum/CRStore
 */
export type Selectable<T> = {
	execute(): Promise<T>;
	compile(): CompiledQuery;
	toOperationNode(): SelectQueryNode;
};

export type SelectedStream<S extends Selectable<any>> = Observable<Awaited<ReturnType<S["execute"]>>>;
export type SelectedStreamFn<DB extends Record<string, any>> = <S extends Selectable<any>>(
	ctx: debug.DebugCtx,
	qb: (db: Kysely<DB>) => S,
	idPrefix?: string
) => SelectedStream<S>;

export type DatabaseInterface = DI<{
	_connection(): Promise<Kysely<DatabaseSchema>>;
	// TODO: This is rather sloppy, update the type in a cleaner way
	// _stream: ReturnType<typeof createReactive>["stream"];
	_stream: SelectedStreamFn<DatabaseSchema>;
	_update(cb: (db: Kysely<DatabaseSchema>) => Promise<any>): Promise<void>;
}>;
export type InventoryDatabaseInterface = IDB<
	WarehouseInterface,
	NoteInterface,
	{
		_connection(): Promise<Kysely<DatabaseSchema>>;
		// TODO: This is rather sloppy, update the type in a cleaner way
		_stream: SelectedStreamFn<DatabaseSchema>;
		_update(cb: (db: Kysely<DatabaseSchema>) => Promise<any>): Promise<void>;
	}
>;

export type OrdersDatabaseInterface = ODI<
	CustomerOrderInterface,
	CustomerOrderData,
	{
		_connection(): Promise<Kysely<DatabaseSchema>>;
		_stream: SelectedStreamFn<DatabaseSchema>;
		_update(cb: (db: Kysely<DatabaseSchema>) => Promise<any>): Promise<void>;
	}
>;
