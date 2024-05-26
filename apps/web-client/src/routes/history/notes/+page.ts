import { appPath } from "$lib/paths";
import { redirect } from "@sveltejs/kit";

export const load = () => {
	// There should always be a data in state
	throw redirect(307, appPath("history/notes", new Date().toISOString().slice(0, 10)));
};
