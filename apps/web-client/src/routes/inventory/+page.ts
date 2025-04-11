import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { base } from "$app/paths";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

const _load = async ({ url }: Parameters<PageLoad>[0]) => {
	if ([`${base}/inventory`, `${base}/inventory/`].includes(url.pathname)) {
		redirect(307, appPath("warehouses"));
	}
};

export const load: PageLoad = timed(_load);
