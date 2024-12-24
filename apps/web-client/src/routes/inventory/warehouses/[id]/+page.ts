import { getStock } from "$lib/db/cr-sqlite/stock";
import { getWarehouseById } from "$lib/db/cr-sqlite/warehouse";
import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import { appPath } from "$lib/paths";

export const load: PageLoad = async ({ parent, params, depends }) => {
	const id = Number(params.id);

	depends("warehouse:data");
	depends("warehouse:books");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { dbCtx, id, displayName: "N/A", discount: 0, entries: [] };
	}

	const warehouse = await getWarehouseById(dbCtx.db, id);
	if (!warehouse) {
		throw redirect(307, appPath("inventory"));
	}

	const entries = await getStock(dbCtx.db, { warehouseId: id });

	return { dbCtx, ...warehouse, entries };
};
