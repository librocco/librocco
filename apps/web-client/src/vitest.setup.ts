import { expect, vi } from "vitest";
import * as matchers from '@testing-library/jest-dom/matchers';
import { loadLocale } from "./i18n/i18n-util.sync";
import { setLocale } from "./i18n/i18n-svelte";

import { readable } from "svelte/store";
import * as environment from '$app/environment';
import * as navigation from '$app/navigation';
import * as stores from '$app/stores';

import type { Navigation, Page } from "@sveltejs/kit";

// Required to appease TS
// Add custom jest matchers
expect.extend(matchers);

loadLocale("en");
setLocale("en");

// Mock SvelteKit runtime module $app/environment
vi.mock('$app/environment', (): typeof environment => ({
	browser: false,
	dev: true,
	building: false,
	version: 'any',
  }));
  
  // Mock SvelteKit runtime module $app/navigation
  vi.mock('$app/navigation', (): typeof navigation => ({
	afterNavigate: () => {},
	beforeNavigate: () => {},
	disableScrollHandling: () => {},
	goto: () => Promise.resolve(),
	invalidate: () => Promise.resolve(),
	invalidateAll: () => Promise.resolve(),
	preloadData: () => Promise.resolve({ type: "loaded", status: 200, data: {} }),
	preloadCode: () => Promise.resolve(),
	onNavigate: () => Promise.resolve(),
	pushState: () => Promise.resolve(),
	replaceState: () => Promise.resolve()
  }));
  

vi.mock("$app/stores", (): typeof stores => {
	const getStores: typeof stores.getStores = () => {
		const navigating = readable<Navigation | null>(null);
		const page = readable<Page>({
			url: new URL("http://localhost"),
			params: {},
			route: {
				id: null,
			},
			status: 200,
			error: null,
			data: {},
			form: undefined,
			state: {},
		});
		const updated = { subscribe: readable(false).subscribe, check: async () => false };

		return { navigating, page, updated };
	};

	const page: typeof stores.page = {
		subscribe(fn) {
			return getStores().page.subscribe(fn);
		},
	};
	const navigating: typeof stores.navigating = {
		subscribe(fn) {
			return getStores().navigating.subscribe(fn);
		},
	};
	const updated: typeof stores.updated = {
		subscribe(fn) {
			return getStores().updated.subscribe(fn);
		},
		check: async () => false,
	};

	return {
		getStores,
		navigating,
		page,
		updated,
	};
});
