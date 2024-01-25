import { redirect, type Load } from "@sveltejs/kit";

import { base } from "$app/paths";

import { appPath } from "$lib/paths";

export const load: Load = async ({ url }) => {
	if ([`${base}/inventory`, `${base}/inventory/`].includes(url.pathname)) {
		redirect(307, appPath("warehouses"));
	}
};
