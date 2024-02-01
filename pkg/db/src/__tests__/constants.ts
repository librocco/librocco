/**
 * A boolean check if we're running tests with the full docker compose support
 * (test data container + two test couchdb contaners).
 */
export const __withDocker__ = Boolean(process.env.FULL_TEST_SUPPORT);
