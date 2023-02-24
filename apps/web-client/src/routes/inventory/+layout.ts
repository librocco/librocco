import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

import type { LayoutLoad } from './$types';

import { db } from '$lib/db';

const redirects = {
	outbound: '/inventory/outbound',
	inbound: '/inventory/inbound',
	stock: '/inventory/stock/0-all'
};

export const load: LayoutLoad = async ({ route, params, parent }) => {
	// await db init in ../layout.ts
	// @TODO: parent should probably return the db interface itself, so no need for import (after that unit of work is in)
	await parent();

	// This should re-run on change to path, as far as I understand: https://kit.svelte.dev/docs/load#invalidation
	const docId = params?.id;

	const [, view, location] = route.id.split('/'); // e.g [ '', 'inventory', 'stock', '[...id]' ]

	// DB is initialised only in the browser, so we're prerendering only the html skeleton (without note/warehouse data)
	if (!browser) {
		return {};
	}

	// If we're on the stock page (warehouse view), we're only interested in the warehouse
	if (view !== 'stock' && docId) {
		const warehouse = await db.warehouse(docId).get();
		if (!warehouse) {
			throw redirect(307, redirects[location]);
		}

		return { warehouse };
	}

	// In note view ('inbound/outbount') we need both the note and the warehouse (and db.findNote returns exactly that)
	const findNoteRes = await db.findNote(docId);
	if (!findNoteRes) {
		throw redirect(307, redirects[location]);
	}

	return findNoteRes;
};
