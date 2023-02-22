import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

import type { LayoutLoad } from './$types';

import { db } from '$lib/db';

const redirects = {
	outbound: '/inventory/outbound',
	inbound: '/inventory/inbound',
	stock: '/inventory/stock/0-all'
};

export const load: LayoutLoad = async ({ url, route, params, parent }) => {
	// await db init in ../layout.ts
	await parent();

	// This should re-run on change to path, as far as I understand: https://kit.svelte.dev/docs/load#invalidation
	const currentWarehouseId = params?.id;

	const [, , location] = route.id.split('/'); // e.g [ '', 'inventory', 'stock', '[...id]' ]

	if (browser && currentWarehouseId) {
		const warehouse = await db.warehouse(currentWarehouseId).get();

		if (!warehouse) {
			throw redirect(307, redirects[location]);
		}

		return {
			warehouse
		};
	}

	return {
		warehouse: undefined
	};
};
