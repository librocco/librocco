import { base } from "$app/paths";
import { redirect, type Load } from "@sveltejs/kit";

export const load: Load = async ({ url }) => {
	console.log("Bump");
	if ([`${base}/proto/inventory`, `${base}/proto/inventory/`].includes(url.pathname)) {
		throw redirect(307, `${base}/proto/inventory/warehouses`);
	}
};
