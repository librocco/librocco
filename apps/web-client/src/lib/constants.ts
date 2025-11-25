import { PUBLIC_IS_E2E, PUBLIC_IS_DEBUG, PUBLIC_LOG_LEVEL, PUBLIC_IS_DEMO, PUBLIC_DEMO_DB_URL } from "$env/static/public";
import type { Locales } from "@librocco/shared";

export const LOCAL_STORAGE_SETTINGS = "librocco:settings";
export const LOCAL_STORAGE_APP_SETTINGS = "librocco:app_settings";

export const IS_E2E = PUBLIC_IS_E2E === "true";
export const IS_DEBUG = PUBLIC_IS_DEBUG === "true";
export const IS_DEMO = PUBLIC_IS_DEMO === "true";

export const LOG_LEVEL = PUBLIC_LOG_LEVEL;

export const DEFAULT_LOCALE: Locales = "en";

const PKG_VERSION = import.meta.env.VITE_PKG_VERSION;
export const GIT_SHA = import.meta.env.VITE_GIT_SHA || "dev";
export const VERSION = import.meta.env.VITE_GIT_SHA ? `${PKG_VERSION}-${import.meta.env.VITE_GIT_SHA}` : PKG_VERSION;

export { DEFAULT_VFS } from "$lib/db/cr-sqlite/core/constants";

export const DEMO_DB_NAME = "librocco_demo_db.sqlite3";
export const DEMO_DB_URL = PUBLIC_DEMO_DB_URL;
