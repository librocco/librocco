import { browser } from "$app/environment";

import type { PageLoad } from "./$types";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

import { loadData } from "./dataLoad";

import { timed } from "$lib/utils/timer";

const _load = async ({ params, parent }: Parameters<PageLoad>[0]) => {
	await parent();

	const supplierId = Number(params.id);

	if (!browser) {
		return {
			supplierId,
			ordersViewData: null
		};
	}

	const db = await getDb(app);
	const pageData = await loadData(db, supplierId);

	return { supplierId, pageData };
};

export const load: PageLoad = timed(_load);
