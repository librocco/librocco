import { superValidate } from "sveltekit-superforms/client";
import { zod } from "sveltekit-superforms/adapters";

import type { PageLoad } from "./$types";
import { get } from "svelte/store";
import { settingsStore } from "$lib/stores/app";
import { settingsSchema } from "$lib/forms/schemas";

export const load: PageLoad = async () => {
	const settingsData = get(settingsStore);

	const form = await superValidate(settingsData, zod(settingsSchema));

	return {
		form
	};
};
