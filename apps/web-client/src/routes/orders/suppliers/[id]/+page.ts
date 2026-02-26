import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { appPath } from "$lib/paths";

const _load = async ({ params }: Parameters<PageLoad>[0]) => {
	const supplierId = Number(params.id);
	throw redirect(307, appPath("suppliers", supplierId, "orders"));
};

export const load: PageLoad = _load;
