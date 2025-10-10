import type { Readable } from "svelte/store";

import type { ProgressState } from "$lib/types";

/** An action used to (reactively) update the progress bar during sync */
export function progressBar(node?: HTMLElement, progress?: Readable<ProgressState>) {
	progress.subscribe(({ nProcessed, nTotal }) => {
		const value = nTotal > 0 ? nProcessed / nTotal : 0;
		node?.style.setProperty("width", `${value * 100}%`);
	});
}
