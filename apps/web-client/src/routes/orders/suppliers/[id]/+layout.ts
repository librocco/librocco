import { browser } from "$app/environment";

import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";
import { appPath } from "$lib/paths";
import { timed } from "$lib/utils/timer";

import { ErrNotFound, loadData } from "./dataLoad";

const _load = async ({ params, parent }: Parameters<LayoutLoad>[0]) => {
	const parentData = await parent();

	const supplierId = Number(params.id);

	if (!browser) {
		return {
			supplierId,
			layoutData: null,
			plugins: parentData.plugins
		};
	}

	try {
		const db = await getDb(app);

		const layoutData = await loadData(db, supplierId);

		return {
			supplierId,
			layoutData,
			plugins: parentData.plugins
		};
	} catch (error) {
		if (error instanceof ErrNotFound) {
			throw redirect(307, appPath("suppliers"));
		} else {
			throw error;
		}
	}
};

export const load: LayoutLoad = timed(_load);
