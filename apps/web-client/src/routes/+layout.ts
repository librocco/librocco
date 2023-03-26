import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

import { browser } from "$app/environment";
import { DB_NAME, COUCHDB_HOST, COUCHDB_PORT, COUCHDB_USER, COUCHDB_PASSWORD } from "$lib/constants";

import { createDB } from "$lib/db";

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ["", "/", "/inventory", "/inventory/", "/inventory/stock", "/inventory/stock/"];

export const load: LayoutLoad = async ({ url }) => {
	const { pathname } = url;
	if (redirectPaths.includes(pathname)) {
		throw redirect(307, "/inventory/stock/0-all");
	}

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// If COUCHDB_HOST port is defined, we can assume the "remote" CouchDB is running and we should connect to it.
		const remoteDb = COUCHDB_HOST ? `http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COUCHDB_HOST}:${COUCHDB_PORT}/${DB_NAME}` : undefined;

		return {
			db: await createDB().init({ name: "[DB_INIT]", debug: false }, { remoteDb })
		};
	}

	return {};
};
export const prerender = true;
