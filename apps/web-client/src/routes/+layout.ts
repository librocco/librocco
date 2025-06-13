import { get } from "svelte/store";
import { redirect } from "@sveltejs/kit";
import { detectLocale, navigatorDetector, localStorageDetector } from "typesafe-i18n/detectors";

import { createBookDataExtensionPlugin } from "@librocco/book-data-extension";
import { createGoogleBooksApiPlugin } from "@librocco/google-books-api-plugin";
import { createOpenLibraryApiPlugin } from "@librocco/open-library-api-plugin";

import { dbid } from "$lib/db";
import type { LayoutLoad } from "./$types";
import { browser } from "$app/environment";
import { base } from "$app/paths";

import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
import { setLocale } from "@librocco/shared/i18n-svelte";
import { locales } from "@librocco/shared/i18n-util";

import { appPath } from "$lib/paths";
import { DEFAULT_LOCALE, IS_E2E } from "$lib/constants";
import { newPluginsInterface } from "$lib/plugins";
import { getDB } from "$lib/db/cr-sqlite";
import { ErrDBCorrupted, ErrDBSchemaMismatch } from "$lib/db/cr-sqlite/db";

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/#/stock/")
const redirectPaths = ["", "/", "/#", "/#/"].map((path) => `${base}${path}`);

export const load: LayoutLoad = async ({ url }) => {
	const { pathname, hash } = url;

	if ((redirectPaths.includes(pathname) && !hash) || hash == "#/") {
		redirect(307, appPath("stock"));
	}

	// Check for locale stored in localstorage 'lang' key, fallback to the
	// navigator locale or fallback to default hardcoded in $lib/constants
	let locale = DEFAULT_LOCALE;

	if (browser) {
		locale = detectLocale(DEFAULT_LOCALE, locales, localStorageDetector, navigatorDetector);
	}

	await loadLocaleAsync(locale);
	setLocale(locale);

	const plugins = newPluginsInterface();

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// For debug purposes and manual overrides (e.g. 'schema_version')
		window["getDB"] = getDB;

		// Register plugins
		// Node: We're avoiding plugins in e2e environment as they can lead to unexpected behavior
		if (!IS_E2E) {
			plugins.get("book-fetcher").register(createBookDataExtensionPlugin());
			plugins.get("book-fetcher").register(createOpenLibraryApiPlugin());
			plugins.get("book-fetcher").register(createGoogleBooksApiPlugin());
		}

		// Init the db
		const { getInitializedDB } = await import("$lib/db/cr-sqlite");

		try {
			const dbCtx = await getInitializedDB(get(dbid));
			return { dbCtx, plugins, error: null };
		} catch (err) {
			console.error("Error initializing DB", err);
			// If know error, return it (it will ba handled in the shown dialog)
			if (err instanceof ErrDBCorrupted || err instanceof ErrDBSchemaMismatch) {
				return { dbCtx: null, plugins, error: err as Error };
			}

			// We don't know how to handle this err - throw
			throw err;
		}
	}

	return { dbCtx: null, plugins, error: null };
};
