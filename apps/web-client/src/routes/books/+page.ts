import type { PageLoad } from "./$types";

import { getPublisherList } from "$lib/db/cr-sqlite/books";
import { resolveDbCtx } from "$lib/utils/loading";

import { timed } from "$lib/utils/timer";

const _load: PageLoad = async ({ parent, depends }) => {
	depends("book:data");

	const { dbCtx: dbCtxOrPromise } = await parent();

	const dbCtxPromise = resolveDbCtx(dbCtxOrPromise);

	const publisherListPromise = dbCtxPromise.then((ctx) => {
		if (!ctx) return [];
		return getPublisherList(ctx.db);
	});

	return { dbCtx: dbCtxPromise, publisherList: publisherListPromise };
};

export const load = timed(_load as any) as PageLoad;
