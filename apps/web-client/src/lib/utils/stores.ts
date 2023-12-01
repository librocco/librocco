import type { Readable } from "svelte/store";

export const debounce = <S extends Readable<any>>(store: S, timeout: number): S => {
	let scheduled: NodeJS.Timeout | null = null;

	return {
		subscribe: (notify) => {
			return store.subscribe((value) => {
				if (scheduled) {
					clearTimeout(scheduled);
				}

				scheduled = setTimeout(() => {
					notify(value);
				}, timeout);
			});
		}
	} as S;
};
