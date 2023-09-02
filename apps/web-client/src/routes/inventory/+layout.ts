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
		const warehouseId = docId?.trim().replace(/^\//, "").replace(/\/$/, "");

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
