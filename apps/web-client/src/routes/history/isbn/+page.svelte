<script lang="ts">
	import { Search } from "lucide-svelte";
	import { createDropdownMenu } from "@melt-ui/svelte";

	import type { BookEntry, SearchIndex } from "@librocco/db";
	import { entityListView, testId } from "@librocco/shared";

	import { appPath } from "$lib/paths";

	import { HistoryPage, PlaceholderBox } from "$lib/components";
	import { getDB } from "$lib/db";

	import { createSearchStore } from "$lib/stores/proto/search";
	import { createSearchDropdown } from "./[isbn]/actions";
	import { goto } from "$lib/utils/navigation";
	import { browser } from "$app/environment";

	const { db } = getDB();

	const createMetaString = ({ authors, year, publisher }: Partial<Pick<BookEntry, "authors" | "year" | "publisher">>) =>
		[authors, year, publisher].filter(Boolean).join(", ");

	// #region search
	//
	// Create a search index for books in the db. Each time the books change, we recreate the index.
	// This is more/less inexpensive (around 2sec), considering it runs in the background.
	let index: SearchIndex | undefined;
	db?.books()
		.streamSearchIndex()
		.subscribe((ix) => (index = ix));
	$: if (browser) window["_search_index"] = index;

	$: bookSearch = createSearchStore({ name: "[SEARCH]", debug: false }, index);
	$: search = bookSearch.searchStore;
	$: entries = bookSearch.searchResStore;

	// Create search element actions (and state) and bind the state to the search state of the search store
	const { input, dropdown, value, open } = createSearchDropdown({ onConfirmSelection: (isbn) => goto(appPath("history/isbn", isbn)) });
	$: $search = $value;
	// #endregion search
</script>

<HistoryPage view="history/isbn">
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input autofocus use:input placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex h-full items-center">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">History</h1>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")} data-loaded={true}>
			<!-- Start entity list placeholder -->
			<PlaceholderBox
				title="No book selected"
				description="Use the search field to find the book you're looking for"
				class="center-absolute"
			/>
			<!-- End entity list placeholder -->
		</div>

		<!-- End entity list contaier -->
	</svelte:fragment>
</HistoryPage>

{#if $open && $entries?.length}
	<div use:dropdown>
		<ul class="w-full divide-y overflow-y-auto rounded border bg-white shadow-2xl">
			{#each $entries as { isbn, title, authors, year, publisher }}
				<li on:click={() => (goto(appPath("history/isbn", isbn)), ($open = false))} class="w-full cursor-pointer px-4 py-3">
					<p class="mt-2 text-sm font-semibold leading-none text-gray-900">{isbn}</p>
					<p class="text-xl font-medium">{title || "Unknown Title"}</p>
					<p>{createMetaString({ authors, year, publisher })}</p>
				</li>
			{/each}
		</ul>
	</div>
{/if}
