import { redirect } from "@sveltejs/kit";

import { browser } from "$app/environment";
import { base } from "$app/paths";

import { createDB } from "$lib/db";

import type { LayoutLoad } from "./$types";

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ["", "/", "/inventory", "/inventory/", "/inventory/stock", "/inventory/stock/"].map((path) => `${base}${path}`);

export const load: LayoutLoad = async ({ url }) => {
	const { pathname } = url;

	if (redirectPaths.includes(pathname)) {
		throw redirect(307, `${base}/inventory/stock/0-all`);
	}

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		return {
			db: await createDB().init()
		};
	}

	return {};
};
export const prerender = true;
