<script lang="ts">
	import { Search, Loader2 as Loader } from "lucide-svelte";
	import { writable } from "svelte/store";
	import { tick } from "svelte";

	import type { SearchIndex } from "@librocco/db";
	import { InventoryTable, createTable } from "@librocco/ui";

	import { Page, PlaceholderBox } from "$lib/components";

	import { createFilteredEntriesStore } from "$lib/stores/proto/search";

	import { createIntersectionObserver } from "$lib/actions";

	import { getDB } from "$lib/db";

	const db = getDB();

	// Create a search index for books in the db. Each time the books change, we recreate the index.
	// This is more/less inexpensive (around 2sec), considering it runs in the background.
	let index: SearchIndex | undefined;
	db?.books()
		.streamSearchIndex()
		.subscribe((ix) => (index = ix));

	$: stores = createFilteredEntriesStore({ name: "[SEARCH]", debug: false }, db, index);

	$: search = stores.search;
	$: entries = stores.entries;

	let maxResults = 20;
	const resetMaxResults = () => (maxResults = 20);
	// Reset max results when search string changes
	$: $search.length && resetMaxResults();
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);

	const tableOptions = writable({
		data: $entries
	});
	const table = createTable(tableOptions);
	$: tableOptions.set({ data: $entries?.slice(0, maxResults) });

	let searchField: HTMLInputElement;
	$: tick().then(() => searchField?.focus());

	const autofocus = (node?: HTMLInputElement) => node?.focus();
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input use:autofocus bind:value={$search} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<h1 class="text-2xl font-bold leading-7 text-gray-900">Stock</h1>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if !$search.length}
			<PlaceholderBox title="Search for stock" description="Get started by searching by title, author, ISBN" class="center-absolute">
				<Search slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
		{:else if !$entries?.length}
			<!-- Using await :then trick we're displaying the loading state for 1s, after which we show no-results message -->
			<!-- The waiting state is here so as to not display the no results to quickly (in case of initial search, being slightly slower) -->
			{#await new Promise((r) => setTimeout(r, 1000))}
				<div class="center-absolute">
					<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
				</div>
			{:then}
				<PlaceholderBox title="No results" description="Search found no results" class="center-absolute">
					<Search slot="icon" let:iconProps {...iconProps} />
				</PlaceholderBox>
			{/await}
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-scroll">
				<InventoryTable {table} />

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if $entries?.length > maxResults}
					<div use:scroll.trigger />
				{/if}
			</div>
		{/if}
	</svelte:fragment>
</Page>
