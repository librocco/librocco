import { browser } from "$app/environment";

import type { PageLoad } from "./$types";

import { getPublisherList } from "$lib/db/cr-sqlite/books";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load: PageLoad = async ({ depends }) => {
	depends("book:data");

	if (!browser) {
		return { publisherList: [] as string[] };
	}

	const db = await getDb(app);

	const publisherList = await getPublisherList(db);

	return { publisherList };
};

export const load = timed(_load as any) as PageLoad;
