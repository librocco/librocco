import { redirect } from "@sveltejs/kit";
import { detectLocale, navigatorDetector, localStorageDetector } from "typesafe-i18n/detectors";

import { createBookDataExtensionPlugin } from "@librocco/book-data-extension";
import { createGoogleBooksApiPlugin } from "@librocco/google-books-api-plugin";
import { createOpenLibraryApiPlugin } from "@librocco/open-library-api-plugin";
import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
import { setLocale } from "@librocco/shared/i18n-svelte";
import { locales } from "@librocco/shared/i18n-util";

import type { LayoutLoad } from "./$types";

import { browser } from "$app/environment";
import { base } from "$app/paths";

import { app } from "$lib/app";

import { DEFAULT_LOCALE, IS_DEMO, IS_E2E } from "$lib/constants";

import { appPath } from "$lib/paths";
import { newPluginsInterface } from "$lib/plugins";
import { getDB } from "$lib/db/cr-sqlite";

import { updateTranslationOverrides } from "$lib/i18n-overrides";
import { initApp, initDemoApp } from "$lib/app/init";

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
	await updateTranslationOverrides();
	setLocale(locale);

	const plugins = newPluginsInterface();
	// Register plugins
	// Node: We're avoiding plugins in e2e environment as they can lead to unexpected behavior
	if (browser && !IS_E2E) {
		plugins.get("book-fetcher").register(createBookDataExtensionPlugin());
		plugins.get("book-fetcher").register(createOpenLibraryApiPlugin());
		plugins.get("book-fetcher").register(createGoogleBooksApiPlugin());
	}

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// TODO: set the app to the window (accessible from)
		// For debug purposes and manual overrides (e.g. 'schema_version')
		window["getDB"] = getDB;

		if (IS_DEMO) {
			await initDemoApp(app);
		}

		await initApp(app);

		return { plugins };
	}

	return { plugins };
};
