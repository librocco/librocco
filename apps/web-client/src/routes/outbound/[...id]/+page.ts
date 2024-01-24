import { redirect } from "@sveltejs/kit";

import type { NoteLookupResult, NoteInterface, WarehouseInterface } from "@librocco/db";

import type { PageLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: PageLoad = async ({ params, parent }): Promise<Partial<NoteLookupResult<NoteInterface, WarehouseInterface>>> => {
	// await db init in ../layout.ts
	const { db } = await parent();

	// This should re-run on change to path, as far as I understand: https://kit.svelte.dev/docs/load#invalidation
	const docId = params?.id;

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!db) {
		return {};
	}

	const findNoteRes = await db.findNote(docId);
	if (!findNoteRes) {
		throw redirect(307, appPath("outbound"));
	}
	return findNoteRes;
};
