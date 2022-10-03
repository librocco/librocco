<script>
	import { getContext } from 'svelte';
	import { TABS } from './Tabs.svelte';

	const tab = {};
	const { registerTab, selectTab, selectedTab } = getContext(TABS);

	registerTab(tab);

	export let classes = '';

	const baseClass = '';
	const button = 'border-solid border-[1px] bg-none m-0 text-gray-500';
	const selected = 'border-b-solid border-b-2 border-purple-500 text-gray-900';

	$: tabClass = [baseClass, $selectedTab === tab ? selected : button, classes].join(' ');
</script>

<button class={tabClass} on:click={() => selectTab(tab)}>
	<slot />
</button>
