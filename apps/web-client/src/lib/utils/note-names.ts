import { get } from "svelte/store";

import { LL } from "@librocco/shared/i18n-svelte";

import { ensureWorkstationName } from "$lib/stores/app";

/**
 * @fileoverview Default display names for new notes
 *
 * New notes are named after the workstation they're created on ("Sale Front desk",
 * "Vendita Cassa", ...) so that, with several devices working concurrently, it is
 * always visible where a note originated. The workstation name is device-local
 * (localStorage, never synced), randomly generated on first use and editable on the
 * settings page.
 */

const workstationName = (): string => {
	// The generated default is localized ("Workstation 374" / "Postazione 374") and stored
	// as-is: it's just an initial value for a user-editable name, not a live translation
	return ensureWorkstationName(() => get(LL).common.workstation_default_name({ n: Math.floor(Math.random() * 900) + 100 }));
};

/** Default display name (base) for a new sale note created on this device */
export const newSaleNoteName = (): string => get(LL).common.new_note_names.sale({ workstation: workstationName() });

/** Default display name (base) for a new purchase note created on this device */
export const newPurchaseNoteName = (): string => get(LL).common.new_note_names.purchase({ workstation: workstationName() });
