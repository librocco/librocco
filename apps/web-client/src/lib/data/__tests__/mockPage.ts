import type { Page } from '@sveltejs/kit';
import { writable } from 'svelte/store';

export const page = writable<Partial<Page<Record<string, string>>>>();
