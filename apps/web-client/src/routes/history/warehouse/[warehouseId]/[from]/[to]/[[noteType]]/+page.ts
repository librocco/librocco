import { browser } from "$app/environment";
import { getPastTransactions } from "$lib/db/cr-sqlite/history";
import { getWarehouseById } from "$lib/db/cr-sqlite/warehouse";

import type { PageLoad } from "./$types";
import type { NoteType } from "$lib/db/cr-sqlite/types";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("history:transactions");

	const { to, from } = params;
	const warehouseId = Number(params.warehouseId);
	const noteType = ["inbound", "outbound"].includes(params.noteType) ? (params.noteType as NoteType) : undefined;

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { displayName: "N/A", transactions: [], noteType: "" };
	}

	const startDate = new Date(from);
	const endDate = new Date(to);

	const { displayName } = await getWarehouseById(dbCtx.db, warehouseId);
	const transactions = await getPastTransactions(dbCtx.db, { warehouseId, startDate, endDate, noteType });

	return { displayName, transactions, noteType };
};
