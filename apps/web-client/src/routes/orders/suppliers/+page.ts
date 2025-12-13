import { browser } from "$app/environment";
import type { PageLoad } from "./$types";

import { getAllSuppliers } from "$lib/db/cr-sqlite/suppliers";

import type { SupplierExtended } from "$lib/db/cr-sqlite/types";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ depends }: Parameters<PageLoad>[0]) => {
	depends("suppliers:list");

	if (!browser) {
		return { suppliers: [] as SupplierExtended[] };
	}

	const db = await getDb(app);

	const suppliers = await getAllSuppliers(db);

	return { suppliers };
};

export const load: PageLoad = timed(_load);
