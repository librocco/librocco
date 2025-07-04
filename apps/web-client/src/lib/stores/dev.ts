import { persisted } from "svelte-local-storage-store";
import type { DevSettingsSchema } from "$lib/forms/schemas";
import { writable } from "svelte/store";

export const devSettingsStore = persisted<DevSettingsSchema>("dev-settings", {
	translationsUrl: "",
	customTranslations: false
});

export const customTranslationsActive = writable(false);

devSettingsStore.subscribe(({ customTranslations }) => {
	customTranslationsActive.set(customTranslations);
});

