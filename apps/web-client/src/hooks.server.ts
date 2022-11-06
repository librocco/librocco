import type { Handle } from '@sveltejs/kit';
import path from 'path';

export const handle: Handle = async ({ event, resolve }) => {
	const {
		url: { pathname, origin }
	} = event;

	// When the user enters one of the following paths, we're using "/stock" as default route
	if (['', '/', '/inventory'].includes(pathname)) {
		return Response.redirect(path.join(origin, '/inventory/stock'), 307);
	}

	return resolve(event);
};
