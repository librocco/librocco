import { writable } from "svelte/store";
import { createRemoteDbStore } from "./settings";

export const remoteDbStore = createRemoteDbStore();

export const extensionAvailable = writable<boolean>(false);
