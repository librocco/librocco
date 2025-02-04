import { writable } from "svelte/store";

export type SupplierOrderFilterStatus = "unordered" | "ordered" | "reconciling";

export const supplierOrderFilterStatus = writable<SupplierOrderFilterStatus>("unordered");
