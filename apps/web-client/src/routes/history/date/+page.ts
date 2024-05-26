import { appPath } from "$lib/paths";
import { redirect } from "@sveltejs/kit";

export const load = () => {
	// Use today's date as default
	throw redirect(307, appPath("history/date", new Date().toISOString().slice(0, 10)));
};
