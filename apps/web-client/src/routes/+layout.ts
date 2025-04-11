import { redirect } from "@sveltejs/kit";
import { get } from "svelte/store";
import { navigatorDetector } from "typesafe-i18n/detectors";

import { createBookDataExtensionPlugin } from "@librocco/book-data-extension";
import { createGoogleBooksApiPlugin } from "@librocco/google-books-api-plugin";
import { createOpenLibraryApiPlugin } from "@librocco/open-library-api-plugin";

import { dbid } from "$lib/db";
import type { LayoutLoad } from "./$types";
import { browser } from "$app/environment";
import { base } from "$app/paths";

import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
import { setLocale } from "@librocco/shared/i18n-svelte";
import { detectLocale } from "@librocco/shared/i18n-util";

import { DEFAULT_LOCALE, IS_E2E } from "$lib/constants";
import { newPluginsInterface } from "$lib/plugins";
import { getDB } from "$lib/db/cr-sqlite";

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ["", "/"].map((path) => `${base}${path}`);

export const load: LayoutLoad = async ({ url, route }) => {
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

	const plugins = newPluginsInterface();

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// For debug purposes and manual overrides (e.g. 'schema_version')
		window["getDB"] = getDB;

		// Init the db
		const { getInitializedDB } = await import("$lib/db/cr-sqlite");
		const dbCtx = await getInitializedDB(get(dbid));

		// Register plugins
		// Node: We're avoiding plugins in e2e environment as they can lead to unexpected behavior
		if (!IS_E2E) {
			plugins.get("book-fetcher").register(createBookDataExtensionPlugin());
			plugins.get("book-fetcher").register(createOpenLibraryApiPlugin());
			plugins.get("book-fetcher").register(createGoogleBooksApiPlugin());
		}

		return { dbCtx, status: true, plugins };
	}

	return { dbCtx: null, status: false, plugins };
};

export const prerender = true;
export const trailingSlash = "always";
