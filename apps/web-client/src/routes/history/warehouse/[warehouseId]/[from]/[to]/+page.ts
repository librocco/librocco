import { browser } from "$app/environment";
import { getPastTransactions } from "$lib/db/cr-sqlite/history";
import { getWarehouseById } from "$lib/db/cr-sqlite/warehouse";

import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, params }) => {
	const { to, from } = params;
	const warehouseId = Number(params.warehouseId);

	const { dbCtx } = await parent();

	if (!browser) {
		return { displayName: "N/A", transactions: [] };
	}

	const startDate = new Date(from);
	const endDate = new Date(to);

	const { displayName } = await getWarehouseById(dbCtx.db, warehouseId);
	const transactions = await getPastTransactions(dbCtx.db, { warehouseId, startDate, endDate });

	return { displayName, transactions };
};
