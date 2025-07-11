<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade, fly } from "svelte/transition";
	import { readable, writable } from "svelte/store";
	import { download, generateCsv, mkConfig } from "export-to-csv";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import FileEdit from "$lucide/file-edit";
	import X from "$lucide/x";
	import Loader from "$lucide/loader-2";
	import Printer from "$lucide/printer";
	import MoreVertical from "$lucide/more-vertical";
	import FilePlus from "$lucide/file-plus";

	import { testId } from "@librocco/shared";
	import type { BookData } from "@librocco/shared";

	import { PlaceholderBox, Breadcrumbs, createBreadcrumbs, StockTable, PopoverWrapper, StockBookRow } from "$lib/components";
	import { Page } from "$lib/controllers";
	import { BookForm, bookSchema, type BookFormSchema } from "$lib/forms";
	import { createExtensionAvailabilityStore } from "$lib/stores";
	import { deviceSettingsStore } from "$lib/stores/app";

	import { racefreeGoto } from "$lib/utils/navigation";

	import type { PageData } from "./$types";

	import { printBookLabel } from "$lib/printer";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { mergeBookData } from "$lib/utils/misc";

	import { appPath } from "$lib/paths";
	import { createInboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import { upsertBook } from "$lib/db/cr-sqlite/books";
	import * as stockCache from "$lib/db/cr-sqlite/stock_cache";
	import LL from "@librocco/shared/i18n-svelte";
	import type { GetStockResponseItem } from "$lib/db/cr-sqlite/types";

	export let data: PageData;

	$: ({ plugins, displayName, publisherList, id } = data);
	$: db = data.dbCtx?.db;

	let entries: GetStockResponseItem[] = [];
	$: data.entries.then((e) => (entries = e));

	$: tColumnHeaders = $LL.warehouse_page.table;
	$: tLabels = $LL.warehouse_page.labels;
	$: tPlaceholder = $LL.warehouse_page.placeholder;
	$: tCommon = $LL.common;
	$: tStock = $LL.stock_page.labels;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload when warehouse data changes
		const disposer1 = data.dbCtx?.rx?.onPoint("warehouse", BigInt(data.id), () => invalidate("warehouse:data"));
		// Reload when some stock changes (note being committed)
		const disposer2 = data.dbCtx?.rx?.onRange(["book"], () => invalidate("warehouse:books"));
		// Reload when stock cache invalidates
		const disposer3 = stockCache.onInvalidated(() => invalidate("warehouse:books"));

		disposer = () => (disposer1(), disposer2(), disposer3());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	// #region csv
	const handleExportCsv = () => {
		const csvConfig = mkConfig({
			columnHeaders: [
				{ displayLabel: tColumnHeaders.quantity(), key: "quantity" },
				{ displayLabel: tColumnHeaders.isbn(), key: "isbn" },
				{ displayLabel: tColumnHeaders.title(), key: "title" },
				{ displayLabel: tColumnHeaders.publisher(), key: "publisher" },
				{ displayLabel: tColumnHeaders.authors(), key: "authors" },
				{ displayLabel: tColumnHeaders.year(), key: "year" },
				{ displayLabel: tColumnHeaders.price(), key: "price" },
				{ displayLabel: tColumnHeaders.category(), key: "category" },
				{ displayLabel: tColumnHeaders.edited_by(), key: "edited_by" },
				{ displayLabel: tColumnHeaders.out_of_print(), key: "out_of_print" }
			],
			filename: `${displayName.replace(" ", "-")}-${Date.now()}`
		});

		const gen = generateCsv(csvConfig)(entries);
		download(csvConfig)(gen);
	};
	const csvEntries = readable([] as any[]);

	// #endregion csv

	// #region warehouse-actions
	/**
	 * Handle create note is an `on:click` handler used to create a new inbound note in the provided warehouse.
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateInboundNote = async () => {
		const noteId = await getNoteIdSeq(db);
		await createInboundNote(db, id, noteId); // Id here is warehouseId ^^^
		await goto(appPath("inbound", noteId));
	};
	// #endregion warehouse-actions

	// #region book-form
	let bookFormData = null;

	const onUpdated: SuperForm<BookFormSchema>["options"]["onUpdated"] = async ({ form }) => {
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
	};

	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(plugins);
	// #endregion book-form

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll

	// #region table
	const tableOptions = writable({
		data: entries?.slice(0, maxResults)
	});
	const table = createTable(tableOptions);
	$: tableOptions.set({ data: entries?.slice(0, maxResults) });
	// #endregion table

	$: breadcrumbs = createBreadcrumbs("warehouse", { id, displayName });

	const {
		elements: { trigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = createDialog({
		forceVisible: true
	});

	// #region printing
	$: handlePrintLabel = (book: BookData) => async () => {
		await printBookLabel($deviceSettingsStore.labelPrinterUrl, book);
	};
	// #endregion printing
</script>

<Page title={displayName} view="warehouse" {db} {plugins}>
	<div slot="main" class="h-full w-full flex-col gap-y-4 divide-y overflow-auto">
		<div class="p-4">
			<Breadcrumbs class="" links={breadcrumbs} />
			<div class="flex justify-between">
				{#if $csvEntries?.length}
					<button class="items-center gap-2 rounded-md bg-teal-500 py-[9px] pl-[15px] pr-[17px] text-white" on:click={handleExportCsv}>
						<span class="aria-hidden"> {tLabels.export_to_csv()} </span>
					</button>
				{/if}
			</div>
		</div>

		{#await data.entries}
			<div class="flex grow justify-center">
				<div class="mx-auto translate-y-1/2">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			</div>
		{:then}
			{#if !entries?.length}
				<div class="flex grow justify-center">
					<div class="mx-auto max-w-xl translate-y-1/2">
						<!-- Start entity list placeholder -->
						<PlaceholderBox title={tPlaceholder.title()} description={tPlaceholder.description()}>
							<FilePlus slot="icon" />
							<button slot="actions" on:click={handleCreateInboundNote} class="btn-primary btn w-full">
								{tLabels.new_note()}
							</button>
						</PlaceholderBox>
						<!-- End entity list placeholder -->
					</div>
				</div>
			{:else}
				<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
					<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
					<div>
						<StockTable {table}>
							<tr slot="row" let:row let:rowIx>
								<StockBookRow {row} {rowIx}>
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
												<span class="sr-only">{tLabels.edit_row()} {rowIx}</span>
												<span class="aria-hidden">
													<MoreVertical />
												</span>
											</button>

											<div slot="popover-content" data-testid={testId("popover-container")} class="bg-secondary">
												<button
													use:melt={$trigger}
													data-testid={testId("edit-row")}
													on:m-click={() => {
														const { __kind, warehouseId, warehouseName, warehouseDiscount, quantity, ...bookData } = row;
														bookFormData = bookData;
													}}
													class="btn-secondary btn-sm btn"
												>
													<span class="sr-only">{tLabels.edit_row()} {rowIx}</span>
													<span class="aria-hidden">
														<FileEdit />
													</span>
												</button>

												<button class="btn-secondary btn-sm btn" data-testid={testId("print-book-label")} on:click={handlePrintLabel(row)}>
													<span class="sr-only">{tLabels.print_book_label()} {rowIx}</span>
													<span class="aria-hidden">
														<Printer />
													</span>
												</button>
											</div>
										</PopoverWrapper>
									</div>
								</StockBookRow>
							</tr>
						</StockTable>
					</div>

					<!-- Trigger for the infinite scroll intersection observer -->
					{#if entries?.length > maxResults}
						<div use:scroll.trigger></div>
					{/if}
				</div>
			{/if}
		{/await}
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
					<h2 use:melt={$title} class="text-lg font-medium">{tLabels.edit_book_details()}</h2>
					<p use:melt={$description} class="leading-normal">
						{tLabels.manually_edit_book_details()}
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
						onUpdated
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
