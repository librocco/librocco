import { persisted } from "svelte-local-storage-store";

import { LOCAL_STORAGE_APP_SETTINGS, LOCAL_STORAGE_SETTINGS } from "$lib/constants";
import { defaults } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { settingsSchema } from "$lib/forms/schemas";

const autoPrintLabelsInner = persisted(LOCAL_STORAGE_APP_SETTINGS, false);
const toggleAutoprintLabels = () => autoPrintLabelsInner.update((v) => !v);
export const autoPrintLabels = Object.assign(autoPrintLabelsInner, { toggle: toggleAutoprintLabels });

const { data: defaultSettings } = defaults(zod(settingsSchema));
export const settingsStore = persisted(LOCAL_STORAGE_SETTINGS, { defaultSettings });
