import { redirect } from '@sveltejs/kit';

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ['', '/', '/inventory', '/inventory/', '/inventory/stock', '/inventory/stock/'];

/** @type {import('./$types').LayoutLoad} */
export async function load({ url }) {
	const { pathname } = url;

	if (redirectPaths.includes(pathname)) {
		throw redirect(307, '/inventory/stock/all');
	}

	return {};
}

export const prerender = true;
