import { persisted } from "svelte-local-storage-store";
import { LOCAL_STORAGE_SETTINGS } from "$lib/constants";
import { superValidateSync } from "sveltekit-superforms/client";
import { settingsSchema } from "$lib/forms";

const { data: defaultSettings } = superValidateSync(settingsSchema)
export const settingsStore = persisted(LOCAL_STORAGE_SETTINGS, defaultSettings);
;
