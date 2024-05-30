import { get, writable, type Writable } from "svelte/store";

import { browser } from "$app/environment";

const click = (cb: () => void) => (node: HTMLElement) => {
	node.addEventListener("click", cb);
	return () => node.removeEventListener("click", cb);
};

const keydown = (cb: (e: KeyboardEvent) => void) => (node: HTMLElement) => {
	node.addEventListener("keydown", cb);
	return () => node.removeEventListener("keydown", cb);
};

const input = (cb: (e: InputEvent) => void) => (node: HTMLInputElement) => {
	node.addEventListener("input", cb);
	return () => node.removeEventListener("input", cb);
};

const register =
	<E extends HTMLElement>(store: Writable<E>) =>
	(node?: E) => (store.set(node), () => store.set(null));

const anchor = (_anchor: HTMLElement | undefined | null, position: (rect: DOMRect) => StyleParams) => (node: HTMLElement) => {
	if (!_anchor) return () => {};

	const style = position(_anchor.getBoundingClientRect());
	const styleStr = Object.entries({ ...style, position: "fixed" })
		.map(([k, v]) => [k, typeof v === "number" ? `${v}px` : v])
		.map(([key, value]) => `${key}: ${value}`)
		.join("; ");
	node.setAttribute("style", styleStr);

	return () => {};
};

type StyleParams = {
	left?: number | string;
	top?: number | string;
	right?: number | string;
	bottom?: number | string;
	width?: number | string;
	height?: number | string;
};

type CreateListener<E extends HTMLElement> = (node: E) => () => void;

const destroyListeners = <E extends HTMLElement>(node: E | undefined, ...listeners: CreateListener<E>[]) => ({
	destroy: listeners
		.map((listener) => (node ? listener(node) : () => {}))
		.reduce(
			(destroy, next) => () => (destroy(), next()),
			() => {}
		)
});

export const createSearchDropdown = ({
	onConfirmSelection = () => Promise.resolve()
}: { onConfirmSelection?: (value: string) => Promise<void> } = {}) => {
	const _search = writable<HTMLInputElement>();
	const _dropdown = writable<HTMLElement>();

	const value = writable<string>("");

	const open = writable(false);

	const reset = () => (open.set(false), value.set(""));

	const closeOnOutsideClick = (e: Event) => {
		if ([_search, _dropdown].map(get).some((el) => el?.contains(e.target as Node))) return;
		open.set(false);
	};

	const closeOnEsc = (e: KeyboardEvent) => e.key === "Escape" && open.set(false);

	open.subscribe((isOpen) => {
		if (browser) {
			isOpen ? document.addEventListener("click", closeOnOutsideClick) : document.removeEventListener("click", closeOnOutsideClick);
			isOpen ? document.addEventListener("keydown", closeOnEsc) : document.removeEventListener("keydown", closeOnEsc);
		}
	});

	const inputAction = (node?: HTMLInputElement) => {
		return destroyListeners(
			node,
			register(_search), // Register the input element
			click(() => open.set(true)), // Open the dropdown on input element click
			input((e) => (open.set(true), value.set((e.target as any).value))),
			keydown((e) => e.key === "Enter" && (onConfirmSelection(get(value)), reset()))
		);
	};

	const dropdownAction = (node?: HTMLElement) => {
		return destroyListeners(
			node,
			register(_dropdown), // Register the dropdown element
			anchor(get(_search), ({ bottom, left, width }) => ({ width, left, top: bottom + 32 })) // Anchor the dropdown to the input
		);
	};

	return { open, input: inputAction, dropdown: dropdownAction, value };
};
