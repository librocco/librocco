import type { Handle } from '@sveltejs/kit';
import path from 'path';

// Paths which are valid (shouldn't return 404, but don't have any content and should get redirected to the default route "/inventory/stock/all")
const redirectPaths = ['', '/', '/inventory', '/inventory/', '/inventory/stock', '/inventory/stock/'];

export const handle: Handle = async ({ event, resolve }) => {
	const {
		url: { pathname, origin }
	} = event;

	if (redirectPaths.includes(pathname)) {
		return Response.redirect(path.join(origin, '/inventory/stock/all'), 307);
	}

	return resolve(event);
};
