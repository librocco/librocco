import type { BookEntry } from "@librocco/db";
import { writable } from "svelte/store";

export const bookData = writable<{ [isbn: string]: BookEntry }>();
