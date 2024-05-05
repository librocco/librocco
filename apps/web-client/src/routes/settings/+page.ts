import { superValidateSync } from "sveltekit-superforms/client";

import { settingsSchema } from "$lib/forms/schemas";
import { settingsStore } from "$lib/stores";

import type { PageLoad } from "./$types";
import { get } from "svelte/store";

export const load: PageLoad = async () => {
	const settingsData = get(settingsStore);

	const form = superValidateSync(settingsData, settingsSchema);

	return {
		form
	};
};
