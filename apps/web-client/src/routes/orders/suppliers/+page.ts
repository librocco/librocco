import type { PageLoad } from "./$types";

import { getAllSuppliers } from "$lib/db/suppliers";

import type { SupplierExtended } from "$lib/db/types";

import { timed } from "$lib/utils/timer";

const _load = async ({ depends, parent }: Parameters<PageLoad>[0]) => {
	depends("suppliers:list");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { suppliers: [] as SupplierExtended[] };
	}

	const suppliers = await getAllSuppliers(dbCtx.db);

	return { suppliers };
};

export const ssr = false;

export const load: PageLoad = timed(_load);
