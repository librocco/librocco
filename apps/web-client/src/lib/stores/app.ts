import { persisted } from "svelte-local-storage-store";

import { LOCAL_STORAGE_APP_SETTINGS, LOCAL_STORAGE_SETTINGS } from "$lib/constants";

const autoPrintLabelsInner = persisted(LOCAL_STORAGE_APP_SETTINGS, false);
const toggleAutoprintLabels = () => autoPrintLabelsInner.update((v) => !v);
export const autoPrintLabels = Object.assign(autoPrintLabelsInner, { toggle: toggleAutoprintLabels });

export const settingsStore = persisted(LOCAL_STORAGE_SETTINGS, {});
