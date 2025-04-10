import type { PageLoad } from "./$types";

import { getAllSuppliers } from "$lib/db/cr-sqlite/suppliers";

import type { SupplierExtended } from "$lib/db/cr-sqlite/types";

import { timed } from "$lib/utils/timer";

const _load: PageLoad = async ({ depends, parent }) => {
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

export const load = timed(_load as any) as PageLoad;
