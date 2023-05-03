import { redirect } from "@sveltejs/kit";
import { base } from "$app/paths";

import type { LayoutLoad } from "./$types";

const redirects = {
	outbound: "/inventory/outbound/",
	inbound: "/inventory/inbound/",
	stock: "/inventory/stock/"
};

export const load: LayoutLoad = async ({ route, params, parent }) => {
	// await db init in ../layout.ts
	const { db } = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!db) {
		return {};
	}

	// This should re-run on change to path, as far as I understand: https://kit.svelte.dev/docs/load#invalidation
	const docId = params?.id;

	const [, , location] = route.id.split("/"); // e.g [ '', 'inventory', 'stock', '[...id]' ]

	// If we're on the stock page (warehouse view), we're only interested in the warehouse
	if (location === "stock" && docId) {
		// * Quick fix for default warehouse "0-all"
		// non-default warehouse docs are always prepended by `v1` => params.id collects `v1/{id}`
		// without version, default warehouse params.id has a trailing slash = `0-all/`
		// this causes db.warehouse().get() to return undefined and creates an infinite redirect
		// (-> ../layout.ts w/ pathname "/inventory/stock" -> back to here with pathname "inventory/stock/0-all")
		// TODO: This should be fixed by adding db export `currentVersion` to all "inventory/stock/v1/0-all" redirects
		// but this also requires update in db package
		const warehouseId = docId === "0-all/" ? "0-all" : docId;

		const warehouse = await db.warehouse(warehouseId).get();

		if (!warehouse) {
			throw redirect(307, `${base}${redirects[location]}`);
		}

		return { warehouse };
	}

	// In note view ('inbound/outbount') we need both the note and the warehouse (and db.findNote returns exactly that)
	if (docId) {
		const findNoteRes = await db.findNote(docId);
		if (!findNoteRes) {
			throw redirect(307, `${base}${redirects[location]}`);
		}
		return findNoteRes;
	}

	return {};
};
