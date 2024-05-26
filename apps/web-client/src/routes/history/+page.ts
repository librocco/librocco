import { redirect } from "@sveltejs/kit";

import { appPath } from "$lib/paths";

export const load = () => {
	// Use date summary as default view
	throw redirect(307, appPath("history/date"));
};
