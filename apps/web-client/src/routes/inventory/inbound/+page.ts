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
	// NOTE: parseInt (rather than Number) tolerates the trailing slash app.html appends on a full
	// document load ("?warehouse=2" gets rewritten to "?warehouse=2/" - parseInt("2/") === 2)
	let warehouseFilter = parseInt(hashParams.get("warehouse") ?? "", 10) || null;

	if (!browser) {
		return { notes: [], warehouses: [] as Warehouse[], warehouseFilter };
	}

	const db = await getDb(app);

	const warehouses: Warehouse[] = await getAllWarehouses(db, { skipTotals: true });

	// Fall back to the unfiltered list if the requested warehouse doesn't exist (e.g. a stale deep
	// link to a warehouse deleted elsewhere) - otherwise the select would render blank above a
	// (misleadingly) empty list
	if (warehouseFilter && !warehouses.some(({ id }) => id === warehouseFilter)) {
		warehouseFilter = null;
	}

	const notes = await getActiveInboundNotes(db, warehouseFilter);

	return { notes, warehouses, warehouseFilter };
};

export const load: PageLoad = timed(_load);
