import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: LayoutLoad = async ({ route, parent }) => {
	const [, , location] = route.id.split("/"); // e.g [ '',  'inventory', 'warehouses', '[...id]' ]

	// If no location provided, use '/warehouses' as default
	if (!location) {
		redirect(307, appPath("warehouses"));
	}

	// It seems as though only the parent res is needed (dbCtx)
	return await parent();
};
