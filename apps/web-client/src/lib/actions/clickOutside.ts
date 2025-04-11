import type { ActionReturn } from "svelte/action";

interface Attributes {
	"on:clickoutside"?: (e: CustomEvent<void>) => void;
}

export function clickOutside(node: HTMLElement, callback?: () => unknown): ActionReturn<Record<string, never>, Attributes> {
	const handleClick = (event: Event) => {
		if (event.target !== null && !node.contains(event.target as Node)) {
			node.dispatchEvent(new CustomEvent("clickoutside"));
			callback?.();
		}
	};

	document.addEventListener("click", handleClick, true);

	return {
		destroy() {
			document.removeEventListener("click", handleClick, true);
		}
	};
}
