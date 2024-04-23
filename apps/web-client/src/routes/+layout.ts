import { redirect } from "@sveltejs/kit";

import { browser } from "$app/environment";
import { base } from "$app/paths";

import { createDB } from "$lib/db";

import type { LayoutLoad } from "./$types";
import { get } from "svelte/store";
import { settingsStore } from "$lib/stores";

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ["", "/"].map((path) => `${base}${path}`);

export const load: LayoutLoad = async ({ url }) => {
	const { pathname } = url;

	if (redirectPaths.includes(pathname)) {
		// * Important: trailing slash is required here
		// * otherwise sveltekit will attempt to add it, and in doing so will strip `base`
		redirect(307, `${base}/stock/`);
	}

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		try {
			const remoteUrl = get(settingsStore).couchUrl;
			// We should init the db first. If there is an existing remote config, the replicator we create next will need it
			const db = await createDB(remoteUrl);

			return {
				db
			};
		} catch (err) {
			//TODO: load modal showing error and two options, go to Settings page to edit the couchUrl or retry the load function
		}
	}

	return {};
};
export const prerender = true;
export const trailingSlash = "always";
