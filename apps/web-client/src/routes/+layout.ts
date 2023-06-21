import { redirect } from "@sveltejs/kit";

import { browser } from "$app/environment";
import { base } from "$app/paths";

import { createDB } from "$lib/db";
import { DEV_COUCH_URL, LOCAL_STORAGE_COUCH_CONFIG } from "$lib/constants";
import { remoteCouchConfigStore } from "$lib/stores/settings";

import type { LayoutLoad } from "./$types";

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ["", "/", "/inventory", "/inventory/", "/inventory/stock", "/inventory/stock/"].map((path) => `${base}${path}`);

export const load: LayoutLoad = async ({ url }) => {
	const { pathname } = url;

	if (redirectPaths.includes(pathname)) {
		// * Important: trailing slash is required here
		// * otherwise sveltekit will attempt to add it, and in doing so will strip `base`
		throw redirect(307, `${base}/inventory/stock/0-all/`);
	}

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// This should only run in dev to connect us to our couch test container
		// and only run once, so that we can test updates via settings page
		if (process.env.NODE_ENV === "development" && !window.localStorage.getItem(LOCAL_STORAGE_COUCH_CONFIG)) {
			remoteCouchConfigStore.set({ couchUrl: DEV_COUCH_URL });
		}

		const db = await createDB();

		return {
			db
		};
	}

	return {};
};
export const prerender = true;
export const trailingSlash = "always";
