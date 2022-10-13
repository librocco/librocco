<script lang="ts">
	import { fade } from 'svelte/transition';

	import { AlignContainerEdge } from './enums';

	export let items: { label: string; href: string; onClick?: () => void }[];
	export let alignItemsEdge: AlignContainerEdge = AlignContainerEdge.Right;

	const containerClasses = [
		alignItemsEdge,
		'absolute',
		'w-max',
		'z-10',
		'mt-2',
		'origin-top-right',
		'divide-y',
		'divide-gray-100',
		'rounded-md',
		'bg-white',
		'shadow-lg',
		'ring-1',
		'ring-black',
		'ring-opacity-5',
		'focus:outline-none'
	].join(' ');

	const linkClasses = [
		'block',
		'px-4',
		'py-2',
		'text-sm',
		'text-gray-700',
		'hover:bg-gray-100',
		'hover:text-gray-900'
	].join(' ');
</script>

<div
	transition:fade
	class={containerClasses}
	role="menu"
	aria-orientation="vertical"
	aria-labelledby="menu-button"
	tabindex="-1"
>
	{#each items as { label, href, onClick }, ix}
		<div class="py-1 px-2 min-w-fit" role="none">
			<a
				{href}
				on:click={onClick}
				class={linkClasses}
				role="menuitem"
				tabindex="-1"
				id="menu-item-${ix}"
			>
				{label}
			</a>
		</div>
	{/each}
</div>
