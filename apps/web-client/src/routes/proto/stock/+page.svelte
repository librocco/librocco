<script lang="ts">
	import { Search } from "lucide-svelte";
	import { writable } from "svelte/store";

	import type { SearchIndex } from "@librocco/db";
	import { InventoryTable, createTable } from "@librocco/ui";

	import { Page, PlaceholderBox } from "$lib/components";

	import { createFilteredEntriesStore } from "$lib/stores/proto/search";

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

	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.set({ data: $entries });
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
			<div class="h-full overflow-y-scroll">
				<InventoryTable {table} />
			</div>
		{/if}
	</svelte:fragment>
</Page>
