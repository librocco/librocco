<script lang="ts">
	import { writable } from "svelte/store";
	import { Search } from "lucide-svelte";

	import { entityListView, testId, type BookData } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { HistoryPage, PlaceholderBox } from "$lib/components";

	import { createSearchDropdown } from "./[isbn]/actions";

	import { goto } from "$lib/utils/navigation";
	import { searchBooks } from "$lib/db/cr-sqlite/books";

	import { appPath } from "$lib/paths";
	import LL from "$i18n/i18n-svelte";

	export let data: PageData;

	$: db = data.dbCtx?.db;

	const createMetaString = ({ authors, year, publisher }: Pick<BookData, "authors" | "year" | "publisher">) =>
		[authors, year, publisher].filter(Boolean).join(", ");

	// #region search
	const search = writable("");

	let entries: BookData[] = [];
	$: if ($search.length > 2) {
		searchBooks(db, $search).then((res) => {
			entries = res;
		});
	} else {
		entries = [];
	}

	// Create search element actions (and state) and bind the state to the search state of the search store
	const { input, dropdown, value, open } = createSearchDropdown({ onConfirmSelection: (isbn) => goto(appPath("history/isbn", isbn)) });
	$: $search = $value;
	// #endregion search
</script>

<HistoryPage view="history/isbn">
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<!-- svelte-ignore a11y_autofocus -->
		<input data-testid={testId("search-input")} autofocus use:input placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex h-full items-center">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">{$LL.historyPage.isbn.history}</h1>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")} data-loaded={true}>
			<!-- Start entity list placeholder -->
			<PlaceholderBox
				title={`${$LL.historyPage.isbn.placeholderBox.title}`}
				description={`${$LL.historyPage.isbn.placeholderBox.description}`}
				class="center-absolute"
			/>
			<!-- End entity list placeholder -->
		</div>

		<!-- End entity list contaier -->
	</svelte:fragment>
</HistoryPage>

{#if $open && entries?.length}
	<div use:dropdown>
		<ul data-testid={testId("search-completions-container")} class="w-full divide-y overflow-y-auto rounded border bg-white shadow-2xl">
			{#each entries as { isbn, title, authors, year, publisher }}
				<li
					class="cursor-pointer items-start px-4 py-3"
					on:click={() => (goto(appPath("history/isbn", isbn)), ($open = false))}
					data-testid={testId("search-completion")}
				>
					<p data-property="isbn" class="mt-2 text-sm font-semibold leading-none text-gray-900">{isbn}</p>
					<p data-property="title" class="text-xl font-medium">{title}</p>
					<p data-property="meta">{createMetaString({ authors, year, publisher })}</p>
				</li>
			{/each}
		</ul>
	</div>
{/if}
