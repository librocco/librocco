import { persisted } from "svelte-local-storage-store";

import { LOCAL_STORAGE_APP_SETTINGS } from "$lib/constants";

const autoPrintLabelsInner = persisted(LOCAL_STORAGE_APP_SETTINGS, false);
const toggleAutoprintLabels = () => autoPrintLabelsInner.update((v) => !v);
export const autoPrintLabels = Object.assign(autoPrintLabelsInner, { toggle: toggleAutoprintLabels });
