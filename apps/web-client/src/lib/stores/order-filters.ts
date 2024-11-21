import { writable } from "svelte/store";

export type OrderFilterStatus = "in_progress" | "completed";

export const orderFilterStatus = writable<OrderFilterStatus>("in_progress");
