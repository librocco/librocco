export const baseURL = process.env.CI ? "http://localhost:4173" : "http://localhost:5173";

/** Max timeout for DOM assertions (waitFor, etc. - longer in CI, default in non-CI) */
export const assertionTimeout = process.env.CI ? 15000 : undefined;
