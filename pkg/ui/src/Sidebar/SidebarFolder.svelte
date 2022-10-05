<script lang="ts">
	import { slide } from 'svelte/transition';
	import { expoOut } from 'svelte/easing';

	import SidebarItem from './SidebarItem.svelte';

	export let name: string;
	export let index: number;
	export let expanded = false;
	export let items: SidebarItem[];

	interface SidebarItem {
		name: string;
		href: string;
		current: boolean;
	}

	const controlId = `sub-menu-${index}`;

	const buttonBaseClasses = [
		'bg-white',
		'text-gray-600',
		'hover:bg-gray-50',
		'hover:text-gray-900',
		'w-full',
		'flex',
		'items-center',
		'pr-2',
		'py-3',
		'text-left',
		'text-sm',
		'font-normal',
		'focus:outline-none',
		'focus:ring-2',
		'focus:ring-teal-500'
	].join(' ');
</script>

<div class="group space-y-1">
	<button
		type="button"
		class={buttonBaseClasses}
		aria-controls={controlId}
		aria-expanded={expanded}
		on:click={() => (expanded = !expanded)}
	>
		<svg class="text-gray-300 mr-2 h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" aria-hidden="true">
			<path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
		</svg>
		{name}
	</button>
	{#if expanded}
		<div class="space-y-1" id={controlId} transition:slide={{ duration: 200, easing: expoOut }}>
			{#each items as { name, href, current }}
				<SidebarItem {name} {href} {current} nested={true} />
			{/each}
		</div>
	{/if}
</div>
