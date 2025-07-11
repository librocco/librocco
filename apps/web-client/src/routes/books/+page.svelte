<script lang="ts">
	import { onDestroy, onMount, tick } from "svelte";
	import { writable } from "svelte/store";
	import { fade, fly } from "svelte/transition";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import Search from "$lucide/search";
	import FileEdit from "$lucide/file-edit";
	import X from "$lucide/x";
	import Printer from "$lucide/printer";
	import MoreVertical from "$lucide/more-vertical";

	import type { BookData } from "@librocco/shared";
	import { testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { LL } from "@librocco/shared/i18n-svelte";

	import { printBookLabel } from "$lib/printer";

	// TODO: check books table/row
	import { PlaceholderBox, PopoverWrapper, BooksTable, BooksTableRow } from "$lib/components";
	// TODO: check book form
	import { BookForm, bookSchema, ScannerForm, scannerSchema, type BookFormSchema } from "$lib/forms";
	import { Page } from "$lib/controllers";
	import { createExtensionAvailabilityStore } from "$lib/stores";
	import { deviceSettingsStore } from "$lib/stores/app";
	import { createIntersectionObserver, createTable } from "$lib/actions";
	import { mergeBookData } from "$lib/utils/misc";
	import { searchBooks, upsertBook } from "$lib/db/cr-sqlite/books";
	import { createOutboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import { appPath } from "$lib/paths";
	import { racefreeGoto } from "$lib/utils/navigation";

	export let data: PageData;

	$: ({ publisherList, plugins } = data);
	$: db = data?.dbCtx?.db;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		disposer = data.dbCtx?.rx?.onRange(["book"], () => invalidate("book:data"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	const search = writable("");
	const orderBy = writable<keyof BookData>("isbn");
	const orderAsc = writable(true);
	let entries = [] as Required<BookData>[];

	let maxResults = 20;
	const resetMaxResults = () => (maxResults = 20);
	// Reset max results when search string changes
	$: if ($search.length > 0) {
		resetMaxResults();
	}
	// Reset max results when order by or order asc changes
	$: if ($orderBy || $orderAsc) {
		resetMaxResults();
	}
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);

	// Each time we update the search string, or max results, requery the entries
	// We're using a sinple hack here:
	// - we're querying for maxResults + 1
	// - this is a cheap way to check if there are more results than requested
	// - further below, we're checking that +1 entry exists, if so, we let the intersection observer know it can requery when reached (infinite scroll)
	//
	// TODO: 'db' should always be defined, as we want this to run ONLY in browser context, but, as of yet, I wasn't able to get this to work
	$: currentQuery = Promise.resolve(
		db ? searchBooks(db, { searchString: $search, orderBy: $orderBy, order: $orderAsc ? "asc" : "desc" }) : ([] as Required<BookData>[])
	);
	$: currentQuery.then((e) => (entries = e));

	const tableOptions = writable({ data: entries.slice(0, maxResults) });
	const table = createTable(tableOptions);
	$: tableOptions.set({ data: entries?.slice(0, maxResults) });

	let searchField: HTMLInputElement;
	$: tick().then(() => searchField?.focus());

	// #region book-form
	let bookFormData = null;

	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(plugins);
	// #endregion book-form

	$: handlePrintLabel = (book: BookData) => async () => {
		await printBookLabel($deviceSettingsStore.labelPrinterUrl, book);
	};

	const {
		elements: { trigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = createDialog({
		forceVisible: true
	});
</script>

<Page title={$LL.books_page.title()} view="stock" {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col gap-y-6">
		<div class="p-4">
			<ScannerForm
				bind:input={searchField}
				placeholder={$LL.search.placeholder()}
				data={defaults(zod(scannerSchema))}
				options={{
					SPA: true,
					dataType: "json",
					validators: zod(scannerSchema),
					validationMethod: "submit-only",
					resetForm: true,
					onUpdated: async ({ form }) => {
						const { isbn } = form?.data as BookData;
						search.set(isbn);
					}
				}}
			/>
		</div>

		{#if !$search.length && !entries?.length}
			<div class="flex grow justify-center">
				<div class="mx-auto max-w-xl translate-y-1/4">
					<PlaceholderBox
						title={$LL.books_page.placeholder.empty_database.title()}
						description={$LL.books_page.placeholder.empty_database.description()}
					>
						<Search slot="icon" />
					</PlaceholderBox>
				</div>
			</div>
		{:else if !entries?.length}
			<!-- Using await :then trick we're displaying the loading state for 1s, after which we show no-results message -->
			<!-- The waiting state is here so as to not display the no results to quickly (in case of initial search, being slightly slower) -->
			{#await currentQuery}
				<div class="flex grow justify-center">
					<div class="mx-auto translate-y-1/4">
						<span class="loading loading-spinner loading-lg text-primary"></span>
					</div>
				</div>
			{:then}
				<div class="flex grow justify-center">
					<div class="mx-auto max-w-xl translate-y-1/4">
						<PlaceholderBox
							title={$LL.books_page.placeholder.no_results.title()}
							description={$LL.books_page.placeholder.no_results.description()}
						>
							<Search slot="icon" />
						</PlaceholderBox>
					</div>
				</div>
			{/await}
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<BooksTable {table} {orderBy} {orderAsc}>
						<svelte:fragment slot="row" let:row let:rowIx>
							<tr use:table.tableRow={{ position: rowIx }}>
								<BooksTableRow {row} {rowIx}>
									<div slot="row-actions">
										<PopoverWrapper
											options={{
												forceVisible: true,
												positioning: {
													placement: "left"
												}
											}}
											let:trigger
										>
											<button
												data-testid={testId("popover-control")}
												{...trigger}
												use:trigger.action
												class="btn-neutral btn-outline btn-sm btn px-0.5"
											>
												<span class="sr-only">{$LL.books_page.labels.edit_row()} {rowIx}</span>
												<span class="aria-hidden">
													<MoreVertical />
												</span>
											</button>

											<div slot="popover-content" data-testid={testId("popover-container")} class="bg-secondary">
												<button
													use:melt={$trigger}
													on:m-click={() => {
														const { __kind, warehouseId, warehouseName, warehouseDiscount, ...bookData } = row;
														bookFormData = bookData;
													}}
													class="btn-secondary btn-sm btn"
												>
													<span class="sr-only">{$LL.books_page.labels.edit_row()} {rowIx}</span>
													<span class="aria-hidden">
														<FileEdit />
													</span>
												</button>

												<button class="btn-secondary btn-sm btn" data-testid={testId("print-book-label")} on:click={handlePrintLabel(row)}>
													<span class="sr-only">{$LL.books_page.labels.print_book_label()} {rowIx}</span>
													<span class="aria-hidden">
														<Printer />
													</span>
												</button>
											</div>
										</PopoverWrapper>
									</div>
								</BooksTableRow>
							</tr>
						</svelte:fragment>
					</BooksTable>
				</div>

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if $table.rows?.length === maxResults && entries.length > maxResults}
					<div use:scroll.trigger></div>
				{/if}
			</div>
		{/if}
	</div>
</Page>

{#if $open}
	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}></div>
		<div
			use:melt={$content}
			class="divide-y-secondary fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 divide-y overflow-y-auto
				bg-base-200 shadow-lg focus:outline-none"
			transition:fly|global={{
				x: 350,
				duration: 300,
				opacity: 1
			}}
		>
			<div class="flex w-full flex-row justify-between bg-base-200 p-6">
				<div>
					<h2 use:melt={$title} class="text-lg font-medium">{$LL.books_page.labels.edit_book_details()}</h2>
					<p use:melt={$description} class="leading-normal">
						{$LL.books_page.labels.manually_edit_book_details()}
					</p>
				</div>
				<button use:melt={$close} aria-label="Close" class="btn-neutral btn-outline btn-md btn">
					<X size={16} />
				</button>
			</div>
			<div class="px-6">
				<BookForm
					data={defaults(bookFormData, zod(bookSchema))}
					{publisherList}
					options={{
						SPA: true,
						dataType: "json",
						validators: zod(bookSchema),
						validationMethod: "submit-only",
						onUpdated: async ({ form }) => {
							/**
							 * This is a quick fix for `form.data` having all optional properties
							 *
							 * Unforuntately, Zod will not infer the correct `data` type from our schema unless we configure `strictNullChecks: true` in our TS config.
							 * Doing so however raises a mountain of "... potentially undefined" type errors throughout the codebase. It will take a significant amount of work
							 * to fix these properly.
							 *
							 * It is still safe to assume that the required properties of BookData are there, as the relative form controls are required
							 */
							const data = form?.data as BookData;

							try {
								await upsertBook(db, data);
								bookFormData = null;
								open.set(false);
							} catch (err) {
								// toastError(`Error: ${err.message}`);
							}
						}
					}}
					onCancel={() => open.set(false)}
					onFetch={async (isbn, form) => {
						const results = await plugins.get("book-fetcher").fetchBookData(isbn, { retryIfAlreadyAttempted: true }).all();

						// Entries from (potentially) multiple sources for the same book (the only one requested in this case)
						const bookData = mergeBookData({ isbn }, results);

						// If there's no book was retrieved from any of the sources, exit early
						if (!bookData) {
							return;
						}

						form.update((data) => ({ ...data, ...bookData }));
						// TODO: handle loading and errors
					}}
					isExtensionAvailable={$bookDataExtensionAvailable}
				/>
			</div>
		</div>
	</div>
{/if}
