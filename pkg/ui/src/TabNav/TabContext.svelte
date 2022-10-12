<script context="module" lang="ts">
	import type { Writable } from 'svelte/store';

	export const TABS = Symbol();

	type Tabs = Writable<string[]>;
	type CurrentTab = Writable<string>;

	export interface TabContext {
		tabs: Tabs;
		currentTab: CurrentTab;
		registerTab: (tabName: string) => void;
		selectTab: (tabName: string) => void;
	}
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	const tabs: Tabs = writable([]);
	const currentTab: CurrentTab = writable('');

	const registerTab = (tabName: string) => tabs.update((tabs) => [...tabs, tabName]);
	const selectTab = (tabName: string) => currentTab.set(tabName);

	setContext<TabContext>(TABS, {
		tabs,
		currentTab,
		registerTab,
		selectTab
	});
</script>

<slot />
