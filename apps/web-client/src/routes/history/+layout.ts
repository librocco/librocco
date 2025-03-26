import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: LayoutLoad = ({ route }) => {
	switch (route.id) {
		// Use daily summary - today as default view, for both unspecified route and daily summary (witout date specified)
		case "/history":
		case "/history/date":
			redirect(307, appPath("history/date", new Date().toISOString().slice(0, 10)));
			break;
		// Use today as default past notes view
		case "/history/notes":
			redirect(307, appPath("history/notes/date", new Date().toISOString().slice(0, 10)));
			break;
		default:
			return {};
	}
};
