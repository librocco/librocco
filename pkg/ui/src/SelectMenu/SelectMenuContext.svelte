<script context="module" lang="ts">
	import type { Writable } from 'svelte/store';

	export const SELECT = Symbol();

	type Items = Writable<string[]>;
	type Current = Writable<string>;

	export interface SelectMenuContext {
		items: Items;
		current: Current;
		registerItem: (item: string) => void;
		selectItem: (item: string) => void;
	}
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';
	export let initialValue: string;

	const items: Items = writable([]);
	const current: Current = writable(initialValue);

	const registerItem = (item: string) => items.update((items) => [...items, item]);
	const selectItem = (item: string) => current.set(item);

	setContext<SelectMenuContext>(SELECT, {
		items,
		current,
		registerItem,
		selectItem
	});
</script>

<slot />
