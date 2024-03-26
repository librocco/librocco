import { writable } from "svelte/store";

const inner = writable(true);
const toggle = () => inner.update((v) => !v);
export const scanAutofocus = Object.assign(inner, { toggle });
