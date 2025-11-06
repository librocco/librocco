import { writable } from "svelte/store";

export const clientError = writable<Error | null>(null);
