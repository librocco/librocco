<script lang="ts">
	import { FilePlus } from 'lucide-svelte';

	export let label = 'New Warehouse';
	export let active = true;
	export let onClick = () => {};

	const indented = label === 'New Note';
</script>

<div class={['mt-0 pr-2', `${indented ? 'pl-11' : 'pl-4'}`].join(' ')} aria-hidden="true">
	<div class="w-full border-t border-dashed border-gray-50" />
	<button
		on:click={onClick}
		type="button"
		class={[
			'flex items-center w-full content-between py-4 font-normal text-sm',
			`${active ? 'text-pink-400' : 'text-gray-400'}`
		].join(' ')}
	>
		<span class={'flex items-center w-full gap-x-2'}>
			{label}
		</span>
		<FilePlus />
	</button>
</div>
