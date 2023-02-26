import { redirect } from '@sveltejs/kit';

import type { LayoutLoad } from './$types';

const redirects = {
	outbound: '/inventory/outbound',
	inbound: '/inventory/inbound',
	stock: '/inventory/stock/0-all'
};

export const load: LayoutLoad = async ({ route, params, parent }) => {
	// await db init in ../layout.ts
	const { db } = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!db) {
		return {};
	}

	// This should re-run on change to path, as far as I understand: https://kit.svelte.dev/docs/load#invalidation
	const docId = params?.id;
	console.log('docId', docId);

	const [, , location] = route.id.split('/'); // e.g [ '', 'inventory', 'stock', '[...id]' ]

	// If we're on the stock page (warehouse view), we're only interested in the warehouse
	if (location === 'stock' && docId) {
		const warehouse = await db.warehouse(docId).get();
		if (!warehouse) {
			throw redirect(307, redirects[location]);
		}

		return { warehouse };
	}

	// In note view ('inbound/outbount') we need both the note and the warehouse (and db.findNote returns exactly that)
	if (docId) {
		const findNoteRes = await db.findNote(docId);
		if (!findNoteRes) {
			throw redirect(307, redirects[location]);
		}
		return findNoteRes;
	}

	return {};
};
