import { persisted } from "svelte-local-storage-store";

import type { LocalStorageSettings } from "$lib/types/settings";

export const settingStore = persisted<LocalStorageSettings>("settings", {});
