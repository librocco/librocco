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
import { loadedLocales } from "@librocco/shared/i18n-util";
import { locales } from "@librocco/shared/i18n-util";

import { DEFAULT_LOCALE, DEFAULT_VFS, IS_E2E } from "$lib/constants";

import { appPath } from "$lib/paths";
import { newPluginsInterface } from "$lib/plugins";
import { getDB } from "$lib/db/cr-sqlite";
import { ErrDBCorrupted, ErrDBSchemaMismatch } from "$lib/db/cr-sqlite/db";
import { validateVFS, type VFSWhitelist } from "$lib/db/cr-sqlite/core/vfs";

import { updateTranslationOverrides } from "$lib/i18n-overrides";

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

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// No need to `await` this here: it's ok if it completes later
		// Actually, maybe I'm being paranoid, but awaiting means we're guaranteed the
		// overrides will be ready before the first paint
		await loadTranslationsOverrides();
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
			// We're allowing for storing of (whitelisted) vfs name in local storage for selection.
			// This will usually only happen in tests/benchmarks and the fallback will
			// be used in production
			const vfs = getVFSFromLocalStorage(DEFAULT_VFS);
			const dbCtx = await getInitializedDB(get(dbid), vfs);
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

async function loadTranslationsOverrides() {
	const urlParams = new URLSearchParams(window.location.search);
	const overrideTranslationsIt = urlParams.get("override-translations-it");
	if (overrideTranslationsIt !== null) {
		console.log("Loading Italian translation overrides");
		const response = await fetch(overrideTranslationsIt);
		const overrides = await response.json();
		deepMergeInPlace(loadedLocales.it, overrides);
	}
}

function deepMergeInPlace(target, source) {
	Object.keys(source).forEach((key) => {
		if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
			if (!target[key] || typeof target[key] !== "object") {
				target[key] = {};
			}
			deepMergeInPlace(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	});
	return target;
}

/**
 * A util used to retrieve the 'vfs' (vfs name) param from the URL. If none is provided, or the
 * provided value is not a whitelisted vfs name, the default one is returned
 *
 */
function getVFSFromLocalStorage(fallback: VFSWhitelist): VFSWhitelist {
	const vfs = window.localStorage.getItem("vfs") || fallback;
	if (!validateVFS(vfs)) {
		console.warn(`unknown value for vfs in local storage: ${vfs}, defaulting to: ${fallback}`);
		return fallback;
	}
	return vfs;
}
