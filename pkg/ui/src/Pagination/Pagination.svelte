<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { ChevronLeft, ChevronRight } from "lucide-svelte";

	import { getItemsToRender } from "./utils";

	/**
	 * Maximum number of items to display, should be at least 5 and an odd number.
	 * - if less then 5 is provided, will throw an error
	 * - if even number provided, will fall back to preceeding odd number
	 * Defaults to 7
	 */
	export let maxItems = 7;
	/**
	 * Total number of pages to patinate over
	 */
	export let numPages: number;
	/**
	 * Currently selected page index (0 - based)
	 */
	export let value: number = 0;

	const dispatch = createEventDispatcher();

	/**
	 * Paginate updates the current page and triggers a change event.
	 * This way we can keep the changes internal, update any value bound to
	 * value and trigger a change event to the parent.
	 * @param page index of the page to switch to
	 */
	function paginate(page: number | null) {
		// No-op if page = null (this shouldn't happen)
		if (page === null) return;
		// Update current page and bound value (if any)
		value = page;
		// Trigger change event
		dispatch("change", page);
	}

	$: itemsToRender = getItemsToRender(numPages, maxItems, value);
</script>

{#if !itemsToRender.length}
	{null}
{:else}
	<nav {...$$restProps} class="flex {$$props.class}">
		<button
			class="button button-inactive {value === 0 ? 'button-disabled' : 'button-hover'}"
			disabled={value === 0}
			on:click={() => paginate(value - 1)}
		>
			<span class="block h-6 w-6">
				<ChevronLeft />
			</span>
		</button>

		{#each itemsToRender as item}
			{#if item === null}
				<button disabled class="button button-inactive">...</button>
			{:else}
				<button
					disabled={value === item}
					class="button button-hover {value === item ? 'button-active' : 'button-inactive'}"
					on:click={() => paginate(item)}
				>
					{item + 1}
				</button>
			{/if}
		{/each}

		<button
			class="button button-inactive {value === itemsToRender[itemsToRender.length - 1] ? 'button-disabled' : 'button-hover'}"
			disabled={value === itemsToRender[itemsToRender.length - 1]}
			on:click={() => paginate(value + 1)}
		>
			<span class="block h-6 w-6">
				<ChevronRight />
			</span>
		</button>
	</nav>
{/if}

<style>
	.button {
		@apply flex h-[38px] w-10 items-center justify-center border text-sm font-medium leading-5;
	}
	.button-inactive {
		@apply border-gray-300 text-gray-500;
	}
	.button-active {
		@apply border-pink-500 bg-pink-50 text-pink-600;
	}
	.button-hover:hover {
		@apply bg-pink-50;
	}
	.button-disabled {
		@apply opacity-50;
	}
</style>
