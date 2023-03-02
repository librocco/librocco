<script lang="ts">
	import { FilePlus } from 'lucide-svelte';

	let className = '';
	export { className as class };
	export let label = 'New Note';
	export let active = true;
</script>

<div class="mt-0 pl-11 pr-2" aria-hidden="true">
	<div class="w-full border-t border-dashed border-gray-50" />
	<button
		on:click
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
