import { browser } from "$app/environment";

import { getPastTransactions } from "$lib/db/cr-sqlite/history";
import { getWarehouseById } from "$lib/db/cr-sqlite/warehouse";

import type { PageLoad } from "./$types";
import type { NoteType } from "$lib/db/cr-sqlite/types";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ params, depends }: Parameters<PageLoad>[0]) => {
	depends("history:transactions");

	const { to, from } = params;
	const warehouseId = Number(params.warehouseId);
	const noteType = ["inbound", "outbound"].includes(params.noteType) ? (params.noteType as NoteType) : undefined;

	if (!browser) {
		return { displayName: "N/A", transactions: [], noteType: "" };
	}

	const startDate = new Date(from);
	const endDate = new Date(to);

	const db = await getDb(app);

	const { displayName } = await getWarehouseById(db, warehouseId);
	const transactions = await getPastTransactions(db, { warehouseId, startDate, endDate, noteType });

	return { displayName, transactions, noteType };
};

export const load: PageLoad = timed(_load);
