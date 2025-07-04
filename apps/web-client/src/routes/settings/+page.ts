import { superValidate } from "sveltekit-superforms/client";
import { zod } from "sveltekit-superforms/adapters";
import { get } from "svelte/store";

import type { PageLoad } from "./$types";

import { deviceSettingsStore } from "$lib/stores/app";
import { devSettingsStore } from "$lib/stores/dev";
import { devSettingsSchema, deviceSettingsSchema, syncSettingsSchema } from "$lib/forms/schemas";

import { syncConfig } from "$lib/db";

import { timed } from "$lib/utils/timer";

const _load: PageLoad = async () => {
	const deviceSettingsData = get(deviceSettingsStore);
	const deviceSettingsForm = await superValidate(deviceSettingsData, zod(deviceSettingsSchema));

	const devSettingsData = get(devSettingsStore);
	const devSettingsForm = await superValidate(devSettingsData, zod(devSettingsSchema));

	const syncSettingsData = get(syncConfig);
	const syncSettingsForm = await superValidate(syncSettingsData, zod(syncSettingsSchema));

	return { deviceSettingsForm, devSettingsForm, syncSettingsForm };
};

export const load = timed(_load as any) as PageLoad;
