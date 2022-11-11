<script lang="ts">
	import { MenuItem } from '@rgossiaux/svelte-headlessui';

	const voidMenuItemClick = () => {};

	export let label: string;
	export let href: string;
	export let index: number;
	export let listLength: number;
	export let onClick = voidMenuItemClick;
</script>

<MenuItem let:active {href} on:click={onClick}>
	<span
		class="block min-w-fit px-5 py-3 text-sm {active
			? 'bg-teal-200 text-gray-700'
			: 'bg-white text-gray-900'} {index === 0 ? 'rounded-t-md' : ''} {index === listLength - 1 ? 'rounded-b-md' : ''}"
	>
		{label}
	</span>
</MenuItem>
