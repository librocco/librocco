import { redirect } from "@sveltejs/kit";

import type { NoteInterface, WarehouseInterface } from "@librocco/db";

import type { LayoutLoad } from "./$types";

import { appPath } from "$lib/paths";
import { get } from "svelte/store";

export const load: LayoutLoad = async ({
	route,
	params,
	parent
}): Promise<Partial<{ note: NoteInterface; warehouse: WarehouseInterface }>> => {
	const [, , location] = route.id.split("/"); // e.g [ '',  'inventory', 'warehouses', '[...id]' ]

	// If no location provided, use '/warehouses' as default
	if (!location) {
		redirect(307, appPath("warehouses"));
	}

	// await db init in ../layout.ts
	const db = await parent();

	// This should re-run on change to path, as far as I understand: https://kit.svelte.dev/docs/load#invalidation
	const docId = params?.id;

	// If db is not returned (we're not in the browser environment, no need for additional loading).
	// Additionally, if no docId is provided, we're on the list page, so no need for additional loading.
	if (!get(db.exists) || !docId) {
		return {};
	}
	const dbInstance = get(db.instance);

	// If we're on the warehouse stock page, we're only interested in the warehouse
	if (location === "warehouses" && docId) {
		const warehouseId = docId?.trim().replace(/^\//, "").replace(/\/$/, "");

		const warehouse = await dbInstance.warehouse(warehouseId).get();

		if (!warehouse) {
			redirect(307, appPath("warehouses"));
		}

		return { warehouse };
	}

	// In note view ('inbound/outbount') we need both the note and the warehouse (and db.findNote returns exactly that)
	const findNoteRes = await dbInstance.findNote(docId);
	if (!findNoteRes) {
		redirect(307, appPath("inbound"));
	}
	return findNoteRes;
};
