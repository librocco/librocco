import { redirect } from '@sveltejs/kit';

import { initDB } from '$lib/db';

import type { LayoutLoad } from './$types';

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ['', '/', '/inventory', '/inventory/', '/inventory/stock', '/inventory/stock/'];

export const load: LayoutLoad = async ({ url }) => {
	await initDB();

	const { pathname } = url;

	if (redirectPaths.includes(pathname)) {
		throw redirect(307, '/inventory/stock/0-all');
	}
};
export const prerender = true;
