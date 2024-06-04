import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: LayoutLoad = ({ route }) => {
	switch (route.id) {
		// Use daily summary - today as default view, for both unspecified route and daily summary (witout date specified)
		case "/history":
		case "/history/date":
			throw redirect(307, appPath("history/date", new Date().toISOString().slice(0, 10)));
		// Use today as default past notes view
		case "/history/notes":
			throw redirect(307, appPath("history/notes", new Date().toISOString().slice(0, 10)));
		default:
			return;
	}
};

export const prerender = false;
export const ssr = false;
