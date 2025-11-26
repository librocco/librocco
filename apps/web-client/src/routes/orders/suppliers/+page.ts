import type { PageLoad } from "./$types";

import { getAllSuppliers } from "$lib/db/cr-sqlite/suppliers";
import { resolveDbCtx } from "$lib/utils/loading";

import type { SupplierExtended } from "$lib/db/cr-sqlite/types";

import { timed } from "$lib/utils/timer";

const _load = async ({ depends, parent }: Parameters<PageLoad>[0]) => {
	depends("suppliers:list");

	const { dbCtx: dbCtxOrPromise } = await parent();

	const dbCtxPromise = resolveDbCtx(dbCtxOrPromise);

	const suppliersPromise = dbCtxPromise.then((ctx) => {
		if (!ctx) return [];
		return getAllSuppliers(ctx.db);
	});

	return { dbCtx: dbCtxPromise, suppliers: suppliersPromise };
};

export const load: PageLoad = timed(_load);
