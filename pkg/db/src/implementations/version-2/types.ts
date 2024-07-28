import type { SvelteDatabase } from "crstore/svelte";
import { Schema } from "crstore";

import type { NoteInterface as NI, WarehouseData as WD, WarehouseInterface as WI, InventoryDatabaseInterface as IDB } from "@/types";

import { schema } from "./schema";

export type NoteInterface = NI;

export type WarehouseData = WD;
export type WarehouseInterface = WI;

export type DatabaseSchema = typeof schema;
export type InventoryDatabaseInterface = IDB<WarehouseInterface, NoteInterface, { _db: SvelteDatabase<Schema<DatabaseSchema>> }>;
