<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade, fly } from "svelte/transition";
	import { readable, writable } from "svelte/store";
	import { download, generateCsv, mkConfig } from "export-to-csv";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { Search, FileEdit, X, Loader2 as Loader, Printer, MoreVertical } from "lucide-svelte";

	import { testId } from "@librocco/shared";
	import type { BookEntry } from "@librocco/db";

	import {
		Page,
		PlaceholderBox,
		Breadcrumbs,
		createBreadcrumbs,
		StockTable,
		ExtensionAvailabilityToast,
		PopoverWrapper,
		StockBookRow
	} from "$lib/components";
	import { BookForm, bookSchema, type BookFormSchema } from "$lib/forms";
	import { settingsStore } from "$lib/stores";

	import { racefreeGoto } from "$lib/utils/navigation";

	import type { PageData } from "./$types";

	import { printBookLabel } from "$lib/printer";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { mergeBookData } from "$lib/utils/misc";

	import { appPath } from "$lib/paths";
	import { createInboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import { upsertBook } from "$lib/db/cr-sqlite/books";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload when warehouse data changes
		const disposer1 = rx.onPoint("warehouse", BigInt(data.id), () => invalidate("warehouse:data"));
		// Reload when some stock changes (note being committed)
		const disposer2 = rx.onRange(["note"], () => invalidate("warehouse:books"));
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data.dbCtx?.db;

	// TODO: revisit when implemented
	// const publisherListCtx = { name: "[PUBLISHER_LIST::INBOUND]", debug: false };
	// const publisherList = readableFromStream(publisherListCtx, db?.books().streamPublishers(publisherListCtx), []);
	const publisherList = readable([]);

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !db;

	$: id = data.id;
	$: displayName = data.displayName;
	$: entries = data.entries;

	// #region csv
	const handleExportCsv = () => {
		const csvConfig = mkConfig({
			columnHeaders: [
				{ displayLabel: "Quantity", key: "quantity" },
				{ displayLabel: "ISBN", key: "isbn" },
				{ displayLabel: "Title", key: "title" },
				{ displayLabel: "Publisher", key: "publisher" },
				{ displayLabel: "Authors", key: "authors" },
				{ displayLabel: "Year", key: "year" },
				{ displayLabel: "Price", key: "price" },
				{ displayLabel: "Category", key: "category" },
				{ displayLabel: "Edited by", key: "edited_by" },
				{ displayLabel: "Out of print", key: "out_of_print" }
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
	const handleCreateNote = () => async () => {
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
		 * It is still safe to assume that the required properties of BookEntry are there, as the relative form controls are required
		 */
		const data = form?.data as BookEntry;

		try {
			await upsertBook(db, data);
			bookFormData = null;
			open.set(false);
		} catch (err) {
			// toastError(`Error: ${err.message}`);
		}
	};

	// TODO: revisit
	// $: bookDataExtensionAvailable = createExtensionAvailabilityStore(db);
	const bookDataExtensionAvailable = readable(false);
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
	$: handlePrintLabel = (book: BookEntry) => async () => {
		await printBookLabel($settingsStore.labelPrinterUrl, book);
	};
	// #endregion printing
</script>

<Page view="warehouse" loaded={!loading}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<div class="flex justify-between">
			<h1 class="mb-2 text-2xl font-bold leading-7 text-gray-900">{displayName}</h1>
			{#if $csvEntries?.length}
				<button class="items-center gap-2 rounded-md bg-teal-500 py-[9px] pl-[15px] pr-[17px] text-white" on:click={handleExportCsv}>
					<span class="aria-hidden"> Export to CSV </span>
				</button>
			{/if}
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if loading}
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else if !entries?.length}
			<PlaceholderBox title="Add new inbound note" description="Get started by adding a new note" class="center-absolute">
				<button on:click={handleCreateNote} class="button button-green mx-auto"><span class="button-text">New note</span></button>
			</PlaceholderBox>
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
											class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
										>
											<span class="sr-only">Edit row {rowIx}</span>
											<span class="aria-hidden">
												<MoreVertical />
											</span>
										</button>

										<div slot="popover-content" data-testid={testId("popover-container")} class="rounded bg-gray-900">
											<button
												use:melt={$trigger}
												data-testid={testId("edit-row")}
												on:m-click={() => {
													const { __kind, warehouseId, warehouseName, warehouseDiscount, quantity, ...bookData } = row;
													bookFormData = bookData;
												}}
												class="rounded p-3 text-gray-500 hover:text-gray-900"
											>
												<span class="sr-only">Edit row {rowIx}</span>
												<span class="aria-hidden">
													<FileEdit />
												</span>
											</button>

											<button
												class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
												data-testid={testId("print-book-label")}
												on:click={handlePrintLabel(row)}
											>
												<span class="sr-only">Print book label {rowIx}</span>
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
					<div use:scroll.trigger />
				{/if}
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>

<div use:melt={$portalled}>
	{#if $open}
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}>
			<div
				use:melt={$content}
				class="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 overflow-y-auto bg-white
				shadow-lg focus:outline-none"
				transition:fly|global={{
					x: 350,
					duration: 300,
					opacity: 1
				}}
			>
				<div class="flex w-full flex-row justify-between bg-gray-50 px-6 py-4">
					<div>
						<h2 use:melt={$title} class="mb-0 text-lg font-medium text-black">Edit book details</h2>
						<p use:melt={$description} class="mb-5 mt-2 leading-normal text-zinc-600">Manually edit book details</p>
					</div>
					<button use:melt={$close} aria-label="Close" class="self-start rounded p-3 text-gray-500 hover:text-gray-900">
						<X class="square-4" />
					</button>
				</div>
				<div class="px-6">
					<BookForm
						data={defaults(bookFormData, zod(bookSchema))}
						publisherList={$publisherList}
						options={{
							SPA: true,
							dataType: "json",
							validators: zod(bookSchema),
							validationMethod: "submit-only",
							onUpdated
						}}
						onCancel={() => open.set(false)}
						onFetch={async (_isbn, form) => {
							// const results = await db.plugin("book-fetcher").fetchBookData(isbn, { retryIfAlreadyAttempted: true }).all();
							const results = [];
							// Entries from (potentially) multiple sources for the same book (the only one requested in this case)
							const bookData = mergeBookData(results);

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
</div>
