import { redirect } from '@sveltejs/kit';

import { db } from '$lib/db';

import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ['', '/', '/inventory', '/inventory/', '/inventory/stock', '/inventory/stock/'];

export const load: LayoutLoad = async ({ route }) => {
	if (redirectPaths.includes(route.id)) {
		throw redirect(307, '/inventory/stock/0-all');
	}

	// If in browser, we init the db, otherwise this is a prerender, for which we're only building basic html skeleton
	if (browser) {
		return {
			db: await db.init({}, { name: '[DB_INIT]', debug: false })
		};
	}

	return {};
};
export const prerender = true;
