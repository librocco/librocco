import type { SvelteDatabase } from "crstore/svelte";
import { Schema } from "crstore";

import type {
	DatabaseInterface as DI,
	NoteInterface as NI,
	NoteData as ND,
	WarehouseData as WD,
	WarehouseInterface as WI,
	InventoryDatabaseInterface as IDB
} from "@/types";

import { schema } from "./schema";

export type NoteData = ND;
export type NoteInterface = NI;

export type WarehouseData = WD;
export type WarehouseInterface = WI;

export type DatabaseSchema = typeof schema;

export type DatabaseInterface = DI<{ _db: SvelteDatabase<Schema<DatabaseSchema>> }>;
export type InventoryDatabaseInterface = IDB<WarehouseInterface, NoteInterface, { _db: SvelteDatabase<Schema<DatabaseSchema>> }>;
