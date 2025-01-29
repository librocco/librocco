import type { PageLoad } from "./$types";

import { getPublisherList } from "$lib/db/cr-sqlite/books";

export const load: PageLoad = async ({ parent, depends }) => {
	depends("book:data");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { dbCtx, publisherList: [] as string[] };
	}

	const publisherList = await getPublisherList(dbCtx.db);

	return { dbCtx, publisherList };
};
