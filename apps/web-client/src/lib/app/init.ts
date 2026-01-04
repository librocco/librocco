import { get } from "svelte/store";
import { detectLocale, navigatorDetector, localStorageDetector } from "typesafe-i18n/detectors";

import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
import { setLocale } from "@librocco/shared/i18n-svelte";
import { locales } from "@librocco/shared/i18n-util";
import { loadedLocales } from "@librocco/shared/i18n-util";

import { DEFAULT_LOCALE, DEFAULT_VFS, IS_DEBUG, IS_E2E } from "$lib/constants";
import { DEMO_VFS } from "$lib/db/cr-sqlite/core/constants";

import { type App } from ".";
import { AppDbState, getDb, initializeDb, initializeDemoDb } from "./db";
import { initializeSync, startSync } from "./sync";

import { updateTranslationOverrides } from "$lib/i18n-overrides";
import { deleteDBFromOPFS } from "$lib/db/cr-sqlite/core/utils";
import { validateVFS, vfsSupportsOPFS, type VFSWhitelist } from "$lib/db/cr-sqlite/core/vfs";
import { getRemoteDB } from "$lib/db/cr-sqlite/core/remote-db";

import * as migrations from "$lib/db/cr-sqlite/debug/migrations";
import * as books from "$lib/db/cr-sqlite/books";
import * as customers from "$lib/db/cr-sqlite/customers";
import * as note from "$lib/db/cr-sqlite/note";
import * as reconciliation from "$lib/db/cr-sqlite/order-reconciliation";
import * as suppliers from "$lib/db/cr-sqlite/suppliers";
import * as warehouse from "$lib/db/cr-sqlite/warehouse";

import { timeLogger } from "$lib/utils/timer";

// ---------------------------------- Init functions ---------------------------------- //

export async function initApp(app: App) {
	if (get(app.state) >= AppDbState.Loading) {
		// TODO: maybe notify of skipped init (console.warn)
		return;
	}

	try {
		attachWindowHelpers(app);
		await initAppImpl(app);
	} catch (err) {
		// NOTE: we're currently only catching here as the error (if any)
		// is already set internally (both the error object as well as state = AppDbState.Error)
		console.error(err);
	}
}

/**
 * Initialises the whole app.
 *
 * NOTE: this is current only safe to run in the browser
 */
async function initAppImpl(app: App) {
	// ---------------------------------- I18N ---------------------------------- //

	await initializeI18n();

	// ---------------------------------- DB ---------------------------------- //

	const vfs = getVFSFromLocalStorage(DEFAULT_VFS);
	await initializeDb(app, get(app.config.dbid), vfs);

	// ---------------------------------- Sync ---------------------------------- //

	const { dbid, syncActive, syncUrl } = app.config;
	await initializeSync(app, vfs);
	if (get(syncActive)) await startSync(app, get(dbid), get(syncUrl));
}

export async function initDemoApp(app: App) {
	if (get(app.state) >= AppDbState.Loading) {
		// TODO: maybe notify of skipped init (console.warn)
		return;
	}

	try {
		attachWindowHelpers(app);
		await initDemoAppImpl(app);
	} catch (err) {
		// NOTE: we're currently only catching here as the error (if any)
		// is already set internally (both the error object as well as state = AppDbState.Error)
		console.error(err);
	}
}

async function initDemoAppImpl(app: App) {
	// ---------------------------------- I18N ---------------------------------- //

	await initializeI18n();

	// ---------------------------------- DB ---------------------------------- //

	const vfs = getDemoVFSFromLocalStorage(DEMO_VFS);
	await initializeDemoDb(app, vfs);
}

// ---------------------------------- Local ---------------------------------- //
async function initializeI18n() {
	// Check for locale stored in localstorage 'lang' key, fallback to the
	// navigator locale or fallback to default hardcoded in $lib/constants
	let locale = DEFAULT_LOCALE;
	locale = detectLocale(DEFAULT_LOCALE, locales, localStorageDetector, navigatorDetector);

	await loadLocaleAsync(locale);
	await updateTranslationOverrides();
	setLocale(locale);

	// No need to `await` this here: it's ok if it completes later
	// Actually, maybe I'm being paranoid, but awaiting means we're guaranteed the
	// overrides will be ready before the first paint
	await loadTranslationsOverrides();
}

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

/**
 * Attach window helpers, these are used for:
 * - manual interactions with the app (through console)
 * - as bridged DB interactions from Playwright environment
 *   (Playwright uses window to retrieve the App, DB, and appropriate DB handlers - ensuring DRY and single-source of truth)
 */
function attachWindowHelpers(app: App) {
	window["_app"] = app;
	window["_getDb"] = getDb;
	window["_getRemoteDB"] = getRemoteDB; // TODO: revisit this

	window["books"] = books;
	window["customers"] = customers;
	window["note"] = note;
	window["reconciliation"] = reconciliation;
	window["suppliers"] = suppliers;
	window["warehouse"] = warehouse;

	window["migrations"] = migrations;
	window["deleteDBFromOPFS"] = deleteDBFromOPFS;

	if (IS_E2E || IS_DEBUG) {
		window["timeLogger"] = timeLogger;
	}
}

// ---------------------------------- Utils ---------------------------------- //

// TODO: move to utils
function deepMergeInPlace(target: any, source: any) {
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
