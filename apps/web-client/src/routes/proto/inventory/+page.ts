import { base } from "$app/paths";
import { PROTO_PATHS } from "$lib/paths";
import { redirect, type Load } from "@sveltejs/kit";

export const load: Load = async ({ url }) => {
	if ([`${base}/proto/inventory`, `${base}/proto/inventory/`].includes(url.pathname)) {
		throw redirect(307, PROTO_PATHS.WAREHOUSES);
	}
};
