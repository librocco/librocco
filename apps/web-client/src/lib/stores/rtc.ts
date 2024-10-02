// src/stores/rtc.ts
import { writable } from "svelte/store";

export const dataChannel = writable<RTCDataChannel | null>(null);
