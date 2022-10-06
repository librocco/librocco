<script context="module" lang="ts">
	import { v4 as uuid } from 'uuid';
	import type { Writable } from 'svelte/store';

	export const TABS = `tabs-${uuid()}`;

	type Tabs = Writable<string[]>;
	type CurrentTab = Writable<string>;

	export interface TabContext {
		tabs: Tabs;
		currentTab: CurrentTab;
		registerTab: (tabId: string) => void;
		selectTab: (tabId: string) => void;
	}
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	const tabs: Tabs = writable([]);
	const currentTab: CurrentTab = writable('');

	const registerTab = (tabId: string) => tabs.update((tabs) => [...tabs, tabId]);
	const selectTab = (tabId: string) => currentTab.set(tabId);

	setContext<TabContext>(TABS, {
		tabs,
		currentTab,
		registerTab,
		selectTab
	});
</script>

<slot />
