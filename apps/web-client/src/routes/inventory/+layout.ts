import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: LayoutLoad = async ({ route, parent }) => {
	await parent();
	const [, , location] = route.id.split("/"); // e.g [ '',  'inventory', 'warehouses', '[...id]' ]

	// If no location provided, use '/warehouses' as default
	if (!location) {
		redirect(307, appPath("warehouses"));
	}
};
