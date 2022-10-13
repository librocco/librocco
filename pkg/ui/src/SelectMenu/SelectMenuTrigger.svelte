<script lang="ts">
	import { getContext } from 'svelte';
	import { ChevronDown } from 'lucide-svelte';

	import { SELECT, type SelectMenuContext } from './SelectMenuContext.svelte';

	export let visible = false;

	const { current } = getContext<SelectMenuContext>(SELECT);
</script>

<div class="relative">
	<div class="inline-flex divide-x divide-teal-600 rounded-md shadow-sm">
		<div class="inline-flex divide-x divide-teal-600 rounded-md shadow-sm">
			<div
				class="inline-flex items-center rounded-l-md border border-transparent bg-teal-500 py-2 pl-3 pr-4 text-white shadow-sm"
			>
				<p class="ml-2.5 text-sm font-medium">{$current}</p>
			</div>
			<button
				type="button"
				class="inline-flex items-center rounded-l-none rounded-r-md bg-teal-500 p-2 text-sm font-medium text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-50"
				aria-haspopup="listbox"
				aria-expanded="true"
				aria-labelledby="listbox-label"
				on:click={() => (visible = !visible)}
			>
				<span class="sr-only">Change published status</span>
				<ChevronDown />
			</button>
		</div>
	</div>
</div>
