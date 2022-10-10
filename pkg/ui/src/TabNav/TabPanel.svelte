<script lang="ts">
	import { getContext } from 'svelte';
	import { TABS, type TabContext } from './TabContext.svelte';

	export let tabIx: number;

	const { tabs, currentTab } = getContext<TabContext>(TABS);

	$: tabId = $tabs[tabIx];
</script>

{#if $currentTab === tabId}
	<slot />
{/if}
