import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

const _load = async ({ url }: Parameters<PageLoad>[0]) => {
	if ([`#/inventory`, `#/inventory/`].includes(url.hash)) {
		redirect(307, appPath("warehouses"));
	}
};

export const load: PageLoad = timed(_load);
