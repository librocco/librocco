import { writable, get } from "svelte/store";

export const createIntersectionObserver = (cb: () => void) => {
	const observer = writable<IntersectionObserver | undefined>(undefined);

	const container = (root?: HTMLElement, opts: IntersectionObserverInit = {}) => {
		if (!root) return;

		observer.update((o) => {
			o?.disconnect();
			return new IntersectionObserver(cb, { root, ...opts });
		});

		return {
			destroy() {
				observer.update((o) => {
					o?.disconnect();
					return undefined;
				});
			}
		};
	};

	const trigger = (node?: HTMLElement) => {
		if (!node) return;

		const unsubscribe = observer.subscribe((o) => o?.observe(node));

		return {
			destroy() {
				get(observer)?.unobserve(node);
				unsubscribe();
			}
		};
	};

	return { container, trigger };
};
