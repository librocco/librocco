import { superValidate } from "sveltekit-superforms/client";
import { zod } from "sveltekit-superforms/adapters";
import { get } from "svelte/store";

import type { PageLoad } from "./$types";

import { deviceSettingsStore } from "$lib/stores/app";
import { deviceSettingsSchema } from "$lib/forms/schemas";
export const load: PageLoad = async () => {
	const deviceSettingsData = get(deviceSettingsStore);
	const deviceSettingsForm = await superValidate(deviceSettingsData, zod(deviceSettingsSchema));

	return { deviceSettingsForm };
};
