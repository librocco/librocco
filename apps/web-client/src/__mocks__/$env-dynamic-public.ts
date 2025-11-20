/**
 * Mock for $env/dynamic/public module
 * Used in test environment where SvelteKit modules are not available
 */

export const env = {
	PUBLIC_DB_NAME: "test",
	PUBLIC_COUCHDB_USER: "admin",
	PUBLIC_COUCHDB_PASSWORD: "admin",
	PUBLIC_COUCHDB_HOST: "127.0.0.1",
	PUBLIC_COUCHDB_PORT: "5000",
	PUBLIC_IS_E2E: "false",
	PUBLIC_IS_DEBUG: "false",
	PUBLIC_LOG_LEVEL: "none",
	PUBLIC_IS_DEMO: "false",
	PUBLIC_DEMO_DB_URL: "",
	PUBLIC_WEBLATE_COMPONENT_URL: "",
	PUBLIC_WEBLATE_API_KEY: ""
};
