import { browser } from "$app/environment";

import { getActiveInboundNotes } from "$lib/db/cr-sqlite/note";
import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";

import type { PageLoad } from "./$types";
import type { Warehouse } from "$lib/db/cr-sqlite/types";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ url, depends, parent }: Parameters<PageLoad>[0]) => {
	await parent();
	depends("inbound:list");

	// NOTE: the app uses hash-based routing, so the query string lives INSIDE the hash
	// (e.g. "#/inventory/inbound/?warehouse=2") and 'url.searchParams' is always empty here.
	// Reading 'url.hash' also registers a URL dependency - the load reruns whenever the hash
	// (including its query part) changes.
	const hashParams = new URLSearchParams(url.hash.split("?")[1] ?? "");
	const warehouseFilter = Number(hashParams.get("warehouse")) || null;

	if (!browser) {
		return { notes: [], warehouses: [] as Warehouse[], warehouseFilter };
	}

	const db = await getDb(app);

	const notes = await getActiveInboundNotes(db, warehouseFilter);
	const warehouses: Warehouse[] = await getAllWarehouses(db, { skipTotals: true });

	return { notes, warehouses, warehouseFilter };
};

export const load: PageLoad = timed(_load);
