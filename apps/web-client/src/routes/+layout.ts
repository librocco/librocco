import { get } from "svelte/store";

import { redirect } from "@sveltejs/kit";

import { navigatorDetector } from "typesafe-i18n/detectors";

import { browser } from "$app/environment";
import { base } from "$app/paths";

import { loadLocaleAsync } from "$i18n/i18n-util.async";
import { setLocale } from "$i18n/i18n-svelte";
import { detectLocale } from "$i18n/i18n-util";

import { createDB, dbNamePersisted } from "$lib/db";

import { DEFAULT_LOCALE } from "$lib/constants";

import type { LayoutLoad } from "./$types";
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

	// Check for navigator locale or fallback to default defined on the server
	// ... then load the locale dict
	// because this is an SPA, the default english dict will be loaded first
	// then will flash update to user preference lang (as long as we've defined it)
	// we could look to use /[[lang]] in our routes if we want to change that, see:
	// - https://kit.svelte.dev/docs/hooks#universal-hooks-reroute
	// - https://github.com/ivanhofer/typesafe-i18n-demo-sveltekit/tree/main/src/routes
	let locale = DEFAULT_LOCALE;

	if (browser) {
		locale = detectLocale(navigatorDetector);
	}

	await loadLocaleAsync(locale);
	setLocale(locale);

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// Init the db
		const name = get(dbNamePersisted);
		const { db, status } = await createDB(name);

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
