<script lang="ts">
	import { Search } from "lucide-svelte";
	import { writable } from "svelte/store";

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
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input bind:value={$search} placeholder="Search" {...inputProps} />
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
			<PlaceholderBox title="No results" description="Search found no results" class="center-absolute">
				<Search slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
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
