import {
	PUBLIC_DB_NAME,
	PUBLIC_COUCHDB_HOST,
	PUBLIC_COUCHDB_PORT,
	PUBLIC_COUCHDB_USER,
	PUBLIC_COUCHDB_PASSWORD,
	PUBLIC_IS_E2E,
	PUBLIC_LOG_LEVEL
} from "$env/static/public";
import type { Locales } from "$i18n/i18n-types";

export const DEV_COUCH_URL = `http://${PUBLIC_COUCHDB_USER}:${PUBLIC_COUCHDB_PASSWORD}@${PUBLIC_COUCHDB_HOST}:${PUBLIC_COUCHDB_PORT}/${PUBLIC_DB_NAME}`;

export const LOCAL_STORAGE_SETTINGS = "librocco:settings";
export const LOCAL_STORAGE_APP_SETTINGS = "librocco:app_settings";

export const LOCAL_POUCH_DB_NAME = "librocco-client";

export const IS_E2E = PUBLIC_IS_E2E === "true";

export const LOG_LEVEL = PUBLIC_LOG_LEVEL;

export const DEFAULT_LOCALE: Locales = "en";

const PKG_VERSION = import.meta.env.VITE_PKG_VERSION;
export const GIT_SHA = import.meta.env.VITE_GIT_SHA || "dev";
export const VERSION = import.meta.env.VITE_GIT_SHA ? `${PKG_VERSION}-${import.meta.env.VITE_GIT_SHA}` : PKG_VERSION;
