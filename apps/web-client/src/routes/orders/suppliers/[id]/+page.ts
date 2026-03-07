import { browser } from "$app/environment";

import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { getDb } from "$lib/app/db";

import { appPath } from "$lib/paths";
import { timed } from "$lib/utils/timer";

import { ErrNotFound, loadLayoutData, loadOrdersViewData, loadPublishersViewData } from "./dataLoad";

const _load = async ({ params, parent }: Parameters<PageLoad>[0]) => {
	const { app } = await parent();

	const supplierId = Number(params.id);

	if (!browser) {
		return {
			supplierId,
			layoutData: null,
			ordersViewData: null,
			publishersViewData: null
		};
	}

	try {
		const db = await getDb(app);

		const [layoutData, ordersViewData, publishersViewData] = await Promise.all([
			loadLayoutData(db, supplierId),
			loadOrdersViewData(db, supplierId),
			loadPublishersViewData(db, supplierId)
		]);

		return {
			supplierId,
			layoutData,
			ordersViewData,
			publishersViewData
		};
	} catch (error) {
		if (error instanceof ErrNotFound) {
			throw redirect(307, appPath("suppliers"));
		}

		throw error;
	}
};

export const load: PageLoad = timed(_load);
