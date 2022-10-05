<script lang="ts">
	import { getContext } from 'svelte';
	import { TABS } from './Tabs.svelte';

	const tab = {};
	const { registerTab, selectTab, selectedTab } = getContext(TABS);

	export let name: string;

	$: href = 'javascript:void(0)'; // `#${name.replace(' ', '-')}`;

	registerTab(tab);

	$: selected = $selectedTab === tab;

	$: linkTextClasses = selected ? 'text-gray-900' : 'text-gray-700 hover:text-gray-700';
	$: linkClasses = [
		linkTextClasses,
		'group',
		'relative',
		'min-w-0',
		'flex-1',
		'overflow-hidden',
		'bg-white',
		'p-4',
		'text-sm',
		'font-mmedium',
		'text-center',
		'hover:bg-gray-50',
		'focus:z-10'
	].join(' ');

	$: spanColourClasses = selected ? 'bg-teal-500' : 'bg-transparent';
	$: spanClasses = [spanColourClasses, 'absolute', 'inset-x-0', 'bottom-0', 'h-0.5'].join(' ');
</script>

<a {href} on:click={() => selectTab(tab)} class={linkClasses} aria-current="page">
	<span>{name}</span>
	<span aria-hidden="true" class={spanClasses} />
</a>
