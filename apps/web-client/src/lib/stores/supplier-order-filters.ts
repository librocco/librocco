import { writable } from "svelte/store";

export type SupplierOrderFilterStatus = "unordered" | "ordered";

export const supplierOrderFilterStatus = writable<SupplierOrderFilterStatus>("unordered");
