<script lang="ts">
	import { writable } from "svelte/store";
	import Search from "$lucide/search";

	import { entityListView, testId, type BookData } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { PlaceholderBox } from "$lib/components";
	import { HistoryPage } from "$lib/controllers";

	import { createSearchDropdown } from "./[isbn]/actions";

	import { goto } from "$lib/utils/navigation";
	import { searchBooks } from "$lib/db/cr-sqlite/books";

	import { appPath } from "$lib/paths";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	$: ({ plugins } = data);
	$: db = data.dbCtx?.db;

	const createMetaString = ({ authors, year, publisher }: Pick<BookData, "authors" | "year" | "publisher">) =>
		[authors, year, publisher].filter(Boolean).join(", ");

	// #region search
	const search = writable("");

	let entries: BookData[] = [];
	$: if ($search.length > 2) {
		searchBooks(db, { searchString: $search }).then((res) => {
			entries = res;
		});
	} else {
		entries = [];
	}

	// Create search element actions (and state) and bind the state to the search state of the search store
	const { input, dropdown, value, open } = createSearchDropdown({ onConfirmSelection: (isbn) => goto(appPath("history/isbn", isbn)) });
	$: $search = $value;

	$: t = $LL.history_page.isbn_tab;
	// #endregion search
</script>

<HistoryPage view="history/isbn" {db} {plugins}>
	<div slot="main" class="h-full w-full">
		<div class="flex w-full p-4">
			<label class="input-bordered input flex flex-1 items-center gap-2">
				<Search />
				<input data-testid={testId("search-input")} use:input placeholder="Search" class="w-full" />
			</label>
		</div>
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")}>
			<div class="flex grow justify-center">
				<div class="mx-auto max-w-xl translate-y-1/2">
					<PlaceholderBox title={`${t.placeholder_box.title()}`} description={`${t.placeholder_box.description()}`} />
				</div>
			</div>
		</div>

		<!-- End entity list contaier -->
	</div>
</HistoryPage>

{#if $open && entries?.length}
	<div use:dropdown>
		<ul data-testid={testId("search-completions-container")} class="bg-base-100 w-full divide-y overflow-y-auto rounded border shadow-2xl">
			{#each entries as { isbn, title, authors, year, publisher }}
				<li
					class="cursor-pointer items-start px-4 py-3"
					on:click={() => (goto(appPath("history/isbn", isbn)), ($open = false))}
					data-testid={testId("search-completion")}
				>
					<p data-property="isbn" class="text-base-content mt-2 text-sm font-semibold leading-none">{isbn}</p>
					<p data-property="title" class="text-xl font-medium">{title}</p>
					<p data-property="meta">{createMetaString({ authors, year, publisher })}</p>
				</li>
			{/each}
		</ul>
	</div>
{/if}
