<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { writable } from "svelte/store";
	import { Search, Library, ArrowLeft, ArrowRight } from "lucide-svelte";
	import { invalidate } from "$app/navigation";

	import { page } from "$app/stores";

	import { entityListView, testId, type BookData } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { PlaceholderBox } from "$lib/components";
	import { HistoryPage } from "$lib/controllers";

	import { createSearchDropdown } from "./actions";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { racefreeGoto } from "$lib/utils/navigation";
	import { searchBooks } from "$lib/db/cr-sqlite/books";

	import { appPath } from "$lib/paths";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	$: ({ plugins, bookData, transactions, stock } = data);
	$: db = data.dbCtx?.db;

	$: isbn = $page.params.isbn;

	$: t = $LL.history_page.isbn_tab.isbn_id;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload when book data changes, or when a note "changes" (we're interested in committed change)
		// We also subscribe to warehouse data changes (for naming/discount changes)
		// We don't subscribe to book_transaction as we're only interested in committed txns - and this is triggered by note change
		//
		// TODO: subscribe to only the book data for the particular ISBN
		disposer = data.dbCtx?.rx?.onRange(["warehouse", "book", "note"], () => invalidate("history:transactions"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

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

	const handlePrint = () => {
		window.print();
	};

	// Create search element actions (and state) and bind the state to the search state of the search store
	const { input, dropdown, value, open } = createSearchDropdown({ onConfirmSelection: (isbn) => goto(appPath("history/isbn", isbn)) });
	$: $search = $value;
	// #endregion search
</script>

<HistoryPage view="history/isbn" {db} {plugins}>
	<div slot="main" class="h-full w-full">
		<div id="search-container" class="flex w-full p-4">
			<div class="flex w-full">
				<label class="input-bordered input flex flex-1 items-center gap-2">
					<Search />
					{#key isbn}
						<input data-testid={testId("search-input")} use:input placeholder="Search" class="w-full" />
					{/key}
				</label>
			</div>
			<button class="btn-neutral btn ml-2 hidden xs:block" on:click={handlePrint} aria-label="Print Table">
				<span class="button-text ml-1">Print Table</span>
			</button>
		</div>

		<div class="w-full text-base-content">
			<h1 class="mb-1 mt-2 text-sm font-semibold leading-none text-base-content">{isbn}</h1>
			{#if bookData}
				<p class="mb-1 min-h-[32px] text-2xl">
					{#if bookData.title}<span class="font-bold">{bookData.title}, </span>{/if}
					{#if bookData.authors}<span>{bookData.authors}</span>{/if}
				</p>
				<p>
					{#if bookData.year}{`${bookData.year}, ` || ""}{/if}
					{#if bookData.publisher}{bookData.publisher || ""}{/if}
				</p>
			{/if}
		</div>
		<div class="overflow-y-auto">
			<!-- Start entity list contaier -->

			<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
			<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")}>
				<div class="border-b border-base-300">
					<h2 id="stock-heading" class="border-b border-base-300 px-4 py-4 pt-8 text-xl font-semibold">{t.titles.stock()}</h2>

					<div data-testid={testId("history-stock-report")} class="divide grid grid-cols-4 gap-x-24 gap-y-4 p-4">
						{#each stock as s}
							<div
								data-testid={testId("history-stock-report-entry")}
								data-warehouse={s.warehouseName}
								class="flex items-center justify-between"
							>
								<p class="flex items-center">
									<Library class="mr-1" size={20} />
									<span data-property="warehouse" class="entity-list-text-sm mr-4">{s.warehouseName}</span>
								</p>

								<p data-property="quantity" class="rounded border border-base-300 bg-base-200 px-2 py-0.5">{s.quantity}</p>
							</div>
						{/each}
					</div>
				</div>

				{#if !transactions?.length}
					<div id="empty" class="flex grow justify-center">
						<div class="mx-auto max-w-xl translate-y-1/2">
							<PlaceholderBox title={t.placeholder_box.title()} description={t.placeholder_box.description()} />
						</div>
					</div>
				{:else}
					<div id="history-table-header" class="sticky top-0">
						<h2 class="border-b border-base-300 bg-base-100 px-4 py-4 pt-8 text-xl font-semibold">
							{$LL.history_page.isbn_tab.titles.transactions()}
						</h2>
					</div>
					<ul id="history-table" class="grid w-full grid-cols-12 divide-y divide-base-300">
						{#each transactions as { quantity, noteId, noteName, noteType, committedAt, warehouseName }}
							<li class="col-span-12 grid grid-cols-12">
								<div class="entity-list-row col-span-8 grid grid-cols-8 items-center text-base-content">
									<p data-property="committedAt" class="col-span-2">
										{generateUpdatedAtString(committedAt)}
									</p>

									<div class="col-span-2 flex items-center">
										<Library class="mr-1" size={20} />
										<p data-property="warehouseName" class="entity-list-text-sm">{warehouseName}</p>
									</div>

									<a href={appPath("history/notes/archive", noteId)} class="col-span-4 flex items-center">
										<div class="{noteType === 'outbound' ? 'badge-red' : 'badge-green'} mx-4 flex items-center rounded-sm px-3">
											{#if noteType === "inbound"}
												<p><ArrowLeft size={16} /></p>
												<p data-property="quantity">{quantity}</p>
											{:else}
												<p data-property="quantity">{quantity}</p>
												<p><ArrowRight size={16} /></p>
											{/if}
										</div>

										<p data-property="noteName">{noteName}</p>
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
	</div>
</HistoryPage>

{#if $open && entries?.length}
	<div use:dropdown>
		<ul data-testid={testId("search-completions-container")} class="w-full divide-y overflow-y-auto rounded border bg-base-100 shadow-2xl">
			{#each entries as { isbn, title, authors, year, publisher }}
				<li
					data-testid={testId("search-completion")}
					on:click={() => (goto(appPath("history/isbn", isbn)), ($open = false))}
					class="w-full cursor-pointer px-4 py-3"
				>
					<p data-property="isbn" class="mt-2 text-sm font-semibold leading-none text-base-content">{isbn}</p>
					<p data-property="title" class="text-xl font-medium">{title}</p>
					<p data-property="meta">{createMetaString({ authors, year, publisher })}</p>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	@media print {
		#history-table-header {
			display: none;
		}
		#empty {
			display: none;
		}
		#search-container {
			display: none;
		}
		#stock-heading {
			display: none;
		}
	}
</style>
