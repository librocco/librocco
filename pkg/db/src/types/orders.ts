/* eslint-disable @typescript-eslint/ban-types */
import { DatabaseInterface as BaseDatabaseInterface, CouchDocument } from "./misc";

export type OrdersDatabaseInterface = BaseDatabaseInterface;

export interface NewOrdersDatabase {
	(db: PouchDB.Database): OrdersDatabaseInterface;
}

/**
 * Standardized supplier interface interface
 */

export type SupplierInterface<A extends Record<string, any> = {}> = SupplierProto<A> & SupplierData<A>;

/**
 * Methods interface
 */
export interface SupplierProto<A extends Record<string, any> = {}> {
	create: () => Promise<SupplierInterface<A>>;
}

/** Data structure */
export type SupplierData<A extends Record<string, any> = {}> = CouchDocument<
	{
		updatedAt: string | null;
		publishers: string[];
		displayName: string;
	} & A
>;
