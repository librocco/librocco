import { DatabaseInterface as BaseDatabaseInterface } from "./misc";

export type OrdersDatabaseInterface = BaseDatabaseInterface;

export interface NewOrdersDatabase {
	(db: PouchDB.Database): OrdersDatabaseInterface;
}
