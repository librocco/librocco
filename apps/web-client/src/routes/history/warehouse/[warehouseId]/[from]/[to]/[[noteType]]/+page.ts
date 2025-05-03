import { getPastTransactions } from "$lib/db/history";
import { getWarehouseById } from "$lib/db/warehouse";

import type { PageLoad } from "./$types";
import type { NoteType } from "$lib/db/types";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
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

export const load: PageLoad = timed(_load);
