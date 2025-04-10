import { redirect, type Load } from "@sveltejs/kit";

import { base } from "$app/paths";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

const _load: Load = async ({ url }) => {
	if ([`${base}/inventory`, `${base}/inventory/`].includes(url.pathname)) {
		redirect(307, appPath("warehouses"));
	}
};

export const load = timed(_load as any) as PageLoad;
