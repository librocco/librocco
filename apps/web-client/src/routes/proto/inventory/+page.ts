import { redirect, type Load } from "@sveltejs/kit";

import { base } from "$app/paths";

import { appPath } from "$lib/paths";

export const load: Load = async ({ url }) => {
	if ([`${base}/proto/inventory`, `${base}/proto/inventory/`].includes(url.pathname)) {
		throw redirect(307, appPath("warehouses"));
	}
};
