<script lang="ts">
	import { Search, Library, ArrowLeft, ArrowRight } from "lucide-svelte";

	import { page } from "$app/stores";

	import type { BookEntry, SearchIndex, VolumeStockClient } from "@librocco/db";
	import { entityListView, testId } from "@librocco/shared";

	import { appPath } from "$lib/paths";

	import { HistoryPage, PlaceholderBox } from "$lib/components";
	import { getDB } from "$lib/db";

	import { createBookHistoryStores } from "$lib/stores/inventory/history_entries";
	import { createFilteredEntriesStore } from "$lib/stores/proto/search";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { goto } from "$app/navigation";
	import { createSearchDropdown } from "./actions";

	const db = getDB();

	$: isbn = $page.params.isbn;

	const dailySummaryCtx = { name: "[BOOK_HISTORY]", debug: false };
	$: stores = createBookHistoryStores(dailySummaryCtx, db, isbn);

	$: bookData = stores.bookData;
	$: transactions = stores.transactions;
	$: stock = stores.stock;

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

	$: bookSearch = createFilteredEntriesStore({ name: "[SEARCH]", debug: false }, db, index);
	$: search = bookSearch.search;
	$: entries = bookSearch.entries;

	// Create search element actions (and state) and bind the state to the search state of the search store
	const { input, dropdown, value, open } = createSearchDropdown({ onConfirmSelection: (isbn) => goto(appPath("history/isbn", isbn)) });
	$: $search = $value;
	// #endregion search
</script>

<HistoryPage view="history/isbn">
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		{#key isbn}
			<input autofocus use:input placeholder="Search" {...inputProps} />
		{/key}
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="w-full text-gray-700">
			<!--text-2xl font-bold leading-7 text-gray-900-->
			<h1 class="mt-2 mb-1 text-sm font-semibold leading-none text-gray-900">{isbn}</h1>
			{#if $bookData}
				<p class="mb-1 min-h-[32px] text-2xl">
					{#if $bookData.title}<span class="font-bold">{$bookData.title}, </span>{/if}
					{#if $bookData.authors}<span>{$bookData.authors}</span>{/if}
				</p>
				<p>
					{#if $bookData.year}{`${$bookData.year}, ` || ""}{/if}
					{#if $bookData.publisher}{$bookData.publisher || ""}{/if}
				</p>
			{/if}
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<div class="overflow-y-auto">
			<!-- Start entity list contaier -->

			<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
			<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")} data-loaded={true}>
				<div class="border-b border-gray-300">
					<h2 class="border-b border-gray-300 px-4 py-4 pt-8 text-xl font-semibold">Stock</h2>

					<div class="divide grid grid-cols-4 gap-x-24 gap-y-4 p-4">
						{#each $stock as s}
							<div class="flex items-center justify-between">
								<p class="flex items-center">
									<Library class="mr-1" size={20} />
									<span class="entity-list-text-sm mr-4">{s.warehouseName}</span>
								</p>

								<p class="rounded border border-gray-500 bg-gray-100 py-0.5 px-2">{s.quantity}</p>
							</div>
						{/each}
					</div>
				</div>

				{#if !$transactions?.length}
					<!-- Start entity list placeholder -->
					<PlaceholderBox
						title="No transactions found"
						description="There seems to be no record for transactions of the given isbn volumes going in or out"
						class="center-absolute"
					/>
					<!-- End entity list placeholder -->
				{:else}
					<div class="sticky top-0">
						<h2 class="border-b border-gray-300 bg-white px-4 py-4 pt-8 text-xl font-semibold">Transactions</h2>
					</div>
					<ul class="grid w-full grid-cols-12 divide-y">
						{#each $transactions as txn}
							{@const quantity = txn.quantity}
							{@const noteId = txn.noteId}
							{@const noteName = txn.noteDisplayName}
							{@const noteType = txn.noteType}
							{@const committedAt = txn.date}
							{@const warehouseName = txn.warehouseName}

							<li class="col-span-12 grid grid-cols-12">
								<div class="entity-list-row col-span-8 grid grid-cols-8 items-center text-gray-800">
									<p class="col-span-2">
										{generateUpdatedAtString(committedAt)}
									</p>

									<div class="col-span-2 flex items-center">
										<Library class="mr-1" size={20} />
										<p class="entity-list-text-sm">{warehouseName}</p>
									</div>

									<a href={appPath("history/notes", noteId)} class="col-span-4 flex items-center">
										<div class="{noteType === 'outbound' ? 'badge-red' : 'badge-green'} mx-4 flex items-center rounded-sm px-3">
											{#if noteType === "inbound"}
												<p><ArrowLeft size={16} /></p>
												<p>{quantity}</p>
											{:else}
												<p>{quantity}</p>
												<p><ArrowRight size={16} /></p>
											{/if}
										</div>

										<p>{noteName}</p>
									</a>
								</div>
							</li>
						{/each}
					</ul>
					<!-- End entity list -->
				{/if}
			</div>

			<!-- End entity list contaier -->
		</div>
	</svelte:fragment>
</HistoryPage>

{#if $open && $entries?.length}
	<div use:dropdown>
		<ul class="w-full divide-y overflow-y-auto rounded border border-gray-300 bg-white shadow-2xl">
			{#each $entries as { isbn, title, authors, year, publisher }}
				<li on:click={() => (goto(appPath("history/isbn", isbn)), ($open = false))} class="w-full cursor-pointer px-4 py-3">
					<p class="mt-2 text-sm font-semibold leading-none text-gray-900">{isbn}</p>
					<p class="text-xl font-medium">{title}</p>
					<p>{createMetaString({ authors, year, publisher })}</p>
				</li>
			{/each}
		</ul>
	</div>
{/if}
