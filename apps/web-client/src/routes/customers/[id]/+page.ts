import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: PageLoad = async ({
	params,
	parent
}): Promise<Partial<{ name: string; surname: string; id: number; email: string; orderLines: { isbn: string; quantity: number }[] }>> => {
	// await db init in ../layout.ts
	const { db } = await parent();

	// This should re-run on change to path, as far as I understand: https://kit.svelte.dev/docs/load#invalidation
	// const docId = params?.id;

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!db) {
		return {};
	}

	// const findNoteRes = await db.findNote(docId);
	// if (!findNoteRes) {
	// 	redirect(307, appPath("outbound"));
	// }
	return new Promise<{ name: string; surname: string; id: number; email: string; orderLines: { isbn: string; quantity: number }[] }>(
		(resolve) =>
			resolve({
				name: "Fadwa",
				surname: "Mahmoud",
				id: 1234,
				email: "fadwa.mahmoud@gmail.com",
				orderLines: [
					{ isbn: "9786556356", quantity: 1 },
					{ isbn: "9786556356", quantity: 1 },
					{ isbn: "9786556356", quantity: 1 },
					{ isbn: "9786556356", quantity: 2 }
				]
			})
	);
};
