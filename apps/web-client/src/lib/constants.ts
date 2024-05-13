import {
	PUBLIC_DB_NAME,
	PUBLIC_COUCHDB_HOST,
	PUBLIC_COUCHDB_PORT,
	PUBLIC_COUCHDB_USER,
	PUBLIC_COUCHDB_PASSWORD,
	PUBLIC_IS_E2E
} from "$env/static/public";

export const DEV_COUCH_URL = `http://${PUBLIC_COUCHDB_USER}:${PUBLIC_COUCHDB_PASSWORD}@${PUBLIC_COUCHDB_HOST}:${PUBLIC_COUCHDB_PORT}/${PUBLIC_DB_NAME}`;

export const LOCAL_STORAGE_SETTINGS = "librocco:settings";
export const LOCAL_STORAGE_APP_SETTINGS = "librocco:app_settings";

export const LOCAL_POUCH_DB_NAME = "librocco-client";

export const IS_E2E = PUBLIC_IS_E2E === "true";
