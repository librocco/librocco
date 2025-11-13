/**
 * Mock for $env/static/public module
 * Used in test environment where SvelteKit modules are not available
 */

export const PUBLIC_DB_NAME = "test";
export const PUBLIC_COUCHDB_USER = "admin";
export const PUBLIC_COUCHDB_PASSWORD = "admin";
export const PUBLIC_COUCHDB_HOST = "127.0.0.1";
export const PUBLIC_COUCHDB_PORT = "5000";
export const PUBLIC_IS_E2E = "false";
export const PUBLIC_IS_DEBUG = "false";
export const PUBLIC_LOG_LEVEL = "none";
export const PUBLIC_IS_DEMO = "false";
export const PUBLIC_DEMO_DB_URL = "";
