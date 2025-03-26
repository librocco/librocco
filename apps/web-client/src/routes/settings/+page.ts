import { superValidate } from "sveltekit-superforms/client";
import { zod } from "sveltekit-superforms/adapters";
import { get } from "svelte/store";

import type { PageLoad } from "./$types";

import { deviceSettingsStore } from "$lib/stores/app";
import { deviceSettingsSchema, syncSettingsSchema } from "$lib/forms/schemas";

import { syncConfig } from "$lib/db";

export const load: PageLoad = async () => {
	const deviceSettingsData = get(deviceSettingsStore);
	const deviceSettingsForm = await superValidate(deviceSettingsData, zod(deviceSettingsSchema));

	const syncSettingsData = get(syncConfig);
	const syncSettingsForm = await superValidate(syncSettingsData, zod(syncSettingsSchema));

	return { deviceSettingsForm, syncSettingsForm };
};
