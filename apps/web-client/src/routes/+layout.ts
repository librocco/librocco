import { get } from "svelte/store";
import { redirect } from "@sveltejs/kit";
import { detectLocale, navigatorDetector, localStorageDetector } from "typesafe-i18n/detectors";

import { createBookDataExtensionPlugin } from "@librocco/book-data-extension";
import { createGoogleBooksApiPlugin } from "@librocco/google-books-api-plugin";
import { createOpenLibraryApiPlugin } from "@librocco/open-library-api-plugin";
import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
import { setLocale } from "@librocco/shared/i18n-svelte";
import { loadedLocales } from "@librocco/shared/i18n-util";
import { locales } from "@librocco/shared/i18n-util";

import type { LayoutLoad } from "./$types";

import { browser } from "$app/environment";
import { base } from "$app/paths";

import { app } from "$lib/app";
import { initializeDb } from "$lib/app/db";

import { dbid } from "$lib/db";

import { DEFAULT_LOCALE, DEFAULT_VFS, DEMO_DB_NAME, IS_DEMO, IS_E2E } from "$lib/constants";

import { appPath } from "$lib/paths";
import { newPluginsInterface } from "$lib/plugins";
import { getDB } from "$lib/db/cr-sqlite";
import { ErrDBCorrupted, ErrDemoDBNotInitialised } from "$lib/db/cr-sqlite/errors";
import { validateVFS, vfsSupportsOPFS, type VFSWhitelist } from "$lib/db/cr-sqlite/core/vfs";

import { updateTranslationOverrides } from "$lib/i18n-overrides";
import { DEMO_VFS } from "$lib/db/cr-sqlite/core/constants";
import { checkOPFSFileExists } from "$lib/db/cr-sqlite/core/utils";

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

		try {
			// DEMO section
			if (IS_DEMO) {
				// Check if the DB exists in OPFS
				if (!(await checkOPFSFileExists(DEMO_DB_NAME))) {
					throw new ErrDemoDBNotInitialised();
				}

				// In demo mode we use the hardcoded VFS
				const vfs = getDemoVFSFromLocalStorage(DEMO_VFS);
				await initializeDb(app, get(dbid), vfs);

				return { plugins, error: null };
			}

			// We're allowing for storing of (whitelisted) vfs name in local storage for selection.
			// This will usually only happen in tests/benchmarks and the fallback will
			// be used in production
			const vfs = getVFSFromLocalStorage(DEFAULT_VFS);
			await initializeDb(app, get(dbid), vfs);

			return { plugins, error: null };
		} catch (err) {
			// Demo DB not initialized - needs user action to fetch
			if (err instanceof ErrDemoDBNotInitialised) {
				return { plugins, error: err as Error };
			}

			console.error("Error initializing DB", err);

			// DB corrupted or migration failed - needs nuke
			// The error is already tracked in initStore, splash will show nuke button
			if (err instanceof ErrDBCorrupted) {
				return { plugins, error: err as Error };
			}

			// Unknown error - also treated as needing nuke
			// The error is already tracked in initStore
			return { plugins, error: err as Error };
		}
	}

	return { plugins, error: null };
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

function getDemoVFSFromLocalStorage(fallback: VFSWhitelist): VFSWhitelist {
	const vfs = window.localStorage.getItem("demo_vfs") || fallback;

	if (!vfsSupportsOPFS(vfs)) {
		console.warn(`unsupported value for demo vfs in local storage: ${vfs}, defaulting to: ${fallback}`);
		return fallback;
	}
	return vfs;
}
