import { redirect } from "@sveltejs/kit";

import { browser } from "$app/environment";
import { base } from "$app/paths";

import { createDB } from "$lib/db";

import type { LayoutLoad } from "./$types";
// import { get } from "svelte/store";
// import { settingsStore } from "$lib/stores";
import { createGoogleBooksApiPlugin } from "@librocco/google-books-api-plugin";
import { createOpenLibraryApiPlugin } from "@librocco/open-library-api-plugin";
import { createBookDataExtensionPlugin } from "@librocco/book-data-extension";

import { IS_E2E } from "$lib/constants";

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ["", "/"].map((path) => `${base}${path}`);

export const load: LayoutLoad = async ({ url }) => {
	const { pathname } = url;

	if (redirectPaths.includes(pathname)) {
		// * Important: trailing slash is required here
		// * otherwise sveltekit will attempt to add it, and in doing so will strip `base`
		redirect(307, `${base}/stock/`);
	}

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// const remoteUrl = get(settingsStore).couchUrl;

		const { db, status } = await createDB("dev");

		// Register plugins
		//
		// Node: We're avoiding plugins in e2e environment as they can lead to unexpected behavior
		if (status && !IS_E2E) {
			db.plugin("book-fetcher").register(createBookDataExtensionPlugin());
			db.plugin("book-fetcher").register(createOpenLibraryApiPlugin());
			db.plugin("book-fetcher").register(createGoogleBooksApiPlugin());
		}

		return {
			db,
			status
		};
	}

	return { status: false };
};
export const prerender = true;
export const trailingSlash = "always";
