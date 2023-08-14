import { redirect } from "@sveltejs/kit";
import { get } from "svelte/store";

import { browser } from "$app/environment";
import { base } from "$app/paths";

import { createDB } from "$lib/db";
import { DEV_COUCH_URL } from "$lib/constants";
import { remoteDbStore } from "$lib/stores";

import type { LayoutLoad } from "./$types";

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ["", "/", "/inventory", "/inventory/", "/inventory/stock", "/inventory/stock/"].map((path) => `${base}${path}`);

export const load: LayoutLoad = async ({ url }) => {
	const { pathname } = url;

	if (redirectPaths.includes(pathname)) {
		// * Important: trailing slash is required here
		// * otherwise sveltekit will attempt to add it, and in doing so will strip `base`
		throw redirect(307, `${base}/inventory/stock/0-all/`);
	}

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		// We should init the db first. If there is an existing remote config, the replicator we create next will need it
		const db = await createDB();

		const remoteDb = get(remoteDbStore);

		if (!remoteDb.replicator) {
			// This should only run in dev to connect us to our couch test container
			// and only run once, so that we can test updates via settings page
			if (process.env.NODE_ENV === "development" && !remoteDb.persistedRemoteConfig) {
				remoteDbStore.createHandler({ url: DEV_COUCH_URL, direction: "sync", live: true, retry: true });
			}

			// If there is a persisted remote config, we should create the handler here so that the settings page loads
			// showing the data, otherwise there will be a flash of form controls
			if (remoteDb.persistedRemoteConfig) {
				remoteDbStore.createHandler(remoteDb.persistedRemoteConfig);
			}
		}

		return {
			db
		};
	}

	return {};
};
export const prerender = true;
export const trailingSlash = "always";
