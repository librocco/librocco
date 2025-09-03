<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade, fly } from "svelte/transition";
	import { writable } from "svelte/store";
	import { invalidate } from "$app/navigation";
	import { filter, scan } from "rxjs";

	import { createDialog, createPopover, melt } from "@melt-ui/svelte";
	import { defaults, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import Printer from "$lucide/printer";
	import QrCode from "$lucide/qr-code";
	import Trash2 from "$lucide/trash-2";
	import FileEdit from "$lucide/file-edit";
	import Plus from "$lucide/plus";

	import MoreVertical from "$lucide/more-vertical";
	import X from "$lucide/x";
	import FileCheck from "$lucide/file-check";

	import { desc, testId } from "@librocco/shared";
	import { type BookData } from "@librocco/shared";

	import type { PageData } from "./$types";
	import type { VolumeStock, OutOfStockTransaction, NoteCustomItem, NoteEntriesItem } from "$lib/db/cr-sqlite/types";

	import {
		Breadcrumbs,
		DropdownWrapper,
		PopoverWrapper,
		PlaceholderBox,
		createBreadcrumbs,
		Dialog,
		OutboundTable,
		TextEditable,
		ForceWithdrawalDialog,
		WarehouseSelect
	} from "$lib/components";
	import { Page } from "$lib/controllers";
	import { defaultDialogConfig } from "$lib/components/Melt";

	import type { InventoryTableData } from "$lib/components/Tables/types";
	import {
		BookForm,
		bookSchema,
		ScannerForm,
		scannerSchema,
		customItemSchema,
		type CustomItemFormSchema,
		type BookFormSchema
	} from "$lib/forms";

	import { type DialogContent } from "$lib/types";
	import { createExtensionAvailabilityStore } from "$lib/stores";
	import { deviceSettingsStore } from "$lib/stores/app";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { mergeBookData } from "$lib/utils/misc";

	import CustomItemForm from "$lib/forms/CustomItemForm.svelte";
	import { printBookLabel, printReceipt } from "$lib/printer";

	import {
		addVolumesToNote,
		commitNote,
		getNoWarehouseEntries,
		getOutOfStockEntries,
		createAndCommitReconciliationNote,
		deleteNote,
		getNoteIdSeq,
		getReceiptForNote,
		removeNoteCustomItem,
		removeNoteTxn,
		updateNote,
		updateNoteTxn,
		upsertNoteCustomItem
	} from "$lib/db/cr-sqlite/note";
	import { getBookData, upsertBook } from "$lib/db/cr-sqlite/books";

	import LL from "@librocco/shared/i18n-svelte";
	import { getStock } from "$lib/db/cr-sqlite/stock";

	export let data: PageData;

	$: ({ id: noteId, displayName, defaultWarehouse, warehouses, updatedAt, plugins } = data);
	$: db = data.dbCtx?.db;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload when note
		const disposer1 = data.dbCtx?.rx?.onPoint("note", BigInt(data.id), () => invalidate("note:data"));
		// Reload when entries (book/custom item) change
		const disposer2 = data.dbCtx?.rx?.onRange(["book", "book_transaction", "custom_item", "warehouse"], () => invalidate("note:books"));
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !db;

	$: bookEntries = data.entries.map((e) => ({ __kind: "book", ...e })) as InventoryTableData[];

	$: customItemEntries = data.customItems.map((e) => ({ __kind: "custom", ...e })) as InventoryTableData[];
	$: publisherList = data.publisherList;

	// Defensive programming: updatedAt will fall back to 0 (items witout updatedAt displayed at the bottom) - this shouldn't really happen (here for type consistency)
	$: entries = bookEntries.concat(customItemEntries).sort(desc((x) => Number(x.updatedAt || 0)));

	$: bookRows = (() => {
		const newBookRows = new Map<string, Map<number, number>>();
		for (const { isbn, warehouseId, quantity } of data.entries as NoteEntriesItem[]) {
			if (!newBookRows.has(isbn)) {
				newBookRows.set(isbn, new Map());
			}
			const warehouseMap = newBookRows.get(isbn)!;
			const preExistingQuantity = warehouseMap.get(warehouseId) || 0;
			warehouseMap.set(warehouseId, preExistingQuantity + quantity);
		}
		return newBookRows;
	})();

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll

	// #region table
	const tableOptions = writable({ data: entries?.slice(0, maxResults) });
	// Generate row key based on identifier (isbn - warehouseId for book rows, id for custom items) to
	// prevent assigning random nanoid (and thus rerendering on every update)
	const generateRowKey = (row: InventoryTableData) => (isBookRow(row) ? [row.isbn, row.warehouseId].join("--") : `custom--${row.id}`);
	const table = createTable(tableOptions, generateRowKey);
	$: tableOptions.set({ data: entries?.slice(0, maxResults) });
	// #endregion table

	// #region note-actions
	const openReconciliationDialog = (invalidTransactions: OutOfStockTransaction[]) => {
		confirmDialogData = invalidTransactions;
		confirmDialogOpen.set(true);
	};

	const handlePrint = () => {
		window.print();
	};

	const handleCommitSelfDryRun = async () => {
		popoverOpen.set(false);

		const noWarehouseTxns = await getNoWarehouseEntries(db, noteId);
		if (noWarehouseTxns.length) {
			popoverOpen.set(true);

			return;
		}

		const outOfStockEntries = await getOutOfStockEntries(db, noteId);
		if (outOfStockEntries.length) {
			openReconciliationDialog(outOfStockEntries);
			return;
		}

		// open confirmation/empty reconciliation dialog
		openReconciliationDialog([]);
	};

	const handleReconcileAndCommitSelf = (invalidTransactions?: OutOfStockTransaction[]) => async (closeDialog: () => void) => {
		// TODO: this should probably be wrapped in a txn, but doing so resulted in app freezing at this point
		const id = await getNoteIdSeq(db);
		if (invalidTransactions) {
			await createAndCommitReconciliationNote(
				db,
				id,
				invalidTransactions.map(({ quantity, available, ...txn }) => ({ ...txn, quantity: quantity - available }))
			);
		}
		await commitNote(db, noteId);
		closeDialog();
		confirmDialogOpen.set(false);
	};

	const handleDeleteSelf = async (closeDialog: () => void) => {
		await deleteNote(db, noteId);
		closeDialog();
	};
	// #region note-actions

	// #region transaction-actions
	const shouldAssignTransaction = async (isbn: string, quantity: number) => {
		const stock = await getStock(db, { isbns: [isbn] });

		const warehouseOptions = stock
			.filter((st) => {
				const totalScanned = bookRows.get(isbn)?.get(st.warehouseId) || 0;
				const warehouseExists = warehouses.find((warehouse) => warehouse.id === st.warehouseId);
				return st.quantity >= quantity + totalScanned && warehouseExists;
			})
			.map((st) => {
				return { warehouseId: st.warehouseId, warehouseName: st.warehouseName };
			});

		if (warehouseOptions.length === 1) {
			return warehouseOptions[0].warehouseId;
		} else if (warehouseOptions.find((wo) => wo.warehouseId === defaultWarehouse)) {
			return defaultWarehouse;
		} else {
			return null;
		}
	};

	const handleAddTransaction = async (isbn: string, quantity = 1, warehouseId?: number) => {
		if (!warehouseId) {
			await addVolumesToNote(db, noteId, { isbn, quantity });
			return;
		}
		await addVolumesToNote(db, noteId, { isbn, quantity, warehouseId });

		// First check if there exists a book entry in the db, if not, fetch book data using external sources
		//
		// Note: this is not terribly efficient, but it's the least ambiguous behaviour to implement
		const localBookData = await getBookData(db, isbn);

		// If book data exists and has 'updatedAt' field - this means we've fetched the book data already
		// no need for further action
		if (localBookData?.updatedAt) {
			return;
		}

		// If local book data doesn't exist at all, create an isbn-only entry
		if (!localBookData) {
			await upsertBook(db, { isbn });
		}

		// At this point there is a simple (isbn-only) book entry, but we should try and fetch the full book data
		plugins
			.get("book-fetcher")
			.fetchBookData(isbn)
			.stream()
			.pipe(
				filter((data) => Boolean(data)),
				// Here we're prefering the latest result to be able to observe the updates as they come in
				scan((acc, next) => ({ ...acc, ...next }))
			)
			.subscribe((b) => upsertBook(db, b));
	};

	const updateRowQuantity = async (e: SubmitEvent, { isbn, warehouseId, quantity: currentQty }: VolumeStock) => {
		const data = new FormData(e.currentTarget as HTMLFormElement);
		// Number form control validation means this string->number conversion should yield a valid result
		const nextQty = Number(data.get("quantity"));

		const transaction = { isbn, warehouseId };

		if (currentQty == nextQty) {
			return;
		}

		// calculate difference between total scanned quantity and next quantity
		const totalScannedQuantity = bookRows.get(isbn)?.get(warehouseId) || 0;
		const difference = nextQty - currentQty;
		const nextTotalQuantity = totalScannedQuantity + difference;

		await updateNoteTxn(db, noteId, transaction, { ...transaction, quantity: nextTotalQuantity });

		forceWithdrawalDialogOpen.set(false);
	};

	const updateRowWarehouse = async (data: InventoryTableData<"book">, nextWarehouseId: number) => {
		popoverOpen.set(false);

		const { isbn, quantity, warehouseId: currentWarehouseId } = data;

		// Number form control validation means this string->number conversion should yield a valid result
		const transaction = { isbn, warehouseId: currentWarehouseId, quantity };

		// Block identical updates (with respect to the existing state) as they might cause an feedback loop when connected to the live db.
		if (currentWarehouseId === nextWarehouseId) {
			return;
		}
		// if assigning from wh1 to wh2 and wh2 has no more stock (all scanned)
		// we should end up with the total quantity of both
		// with wh1 containing the max available stock and the rest is forced

		const totalQuantityCurrentWarehouse = bookRows.get(isbn)?.get(currentWarehouseId);

		const difference = totalQuantityCurrentWarehouse - quantity;
		forceWithdrawalDialogOpen.set(false);

		if (quantity === totalQuantityCurrentWarehouse) {
			await updateNoteTxn(db, noteId, transaction, { warehouseId: nextWarehouseId, quantity });
			return;
		}
		await updateNoteTxn(db, noteId, transaction, { warehouseId: currentWarehouseId, quantity: difference });
		await addVolumesToNote(db, noteId, { isbn, quantity, warehouseId: nextWarehouseId });

		// wh1 has 1 stock and 10 are scanned
		// user clicks on the sub-transaction that's in stock
		// and re-assigns a different warehouse
		// decrement quantity by said amount and in case of a
		// non-pre-existing warehouse create a new transaction
	};

	const deleteRow = (rowIx: number) => async () => {
		const row = entries[rowIx];

		if (isBookRow(row)) {
			const { isbn, warehouseId, quantity } = row;
			const remainingQuantity = bookRows.get(isbn)?.get(warehouseId) - quantity;
			if (remainingQuantity === 0) {
				await removeNoteTxn(db, noteId, { isbn, warehouseId });
				return;
			}
			await updateNoteTxn(db, noteId, { isbn, warehouseId }, { quantity: remainingQuantity, warehouseId });
			return;
		} else {
			await removeNoteCustomItem(db, noteId, row.id);
		}
	};
	// #region transaction-actions

	// #region book-form
	let bookFormData = null;
	let customItemFormData = null;

	// TODO
	/**
	 * A HOF takes in the row and decides on the appropriate handler to return (for appropriate form):
	 * - book form
	 * - custom item form
	 */
	const handleOpenFormPopover = (row: InventoryTableData & { key: string; rowIx: number }) => () => {
		return isBookRow(row) ? openBookForm(row) : openCustomItemForm(row);
	};

	const openBookForm = (row: InventoryTableData<"book"> & { key: string; rowIx: number }) => {
		// eslint-disable-next-line
		// @ts-ignore `__kind` does still exist on the row data here. Types are convulted & misaligned with data
		// this was causing errors when passing the data to the book form.
		const { key, rowIx, __kind, availableWarehouses, warehouseId, warehouseName, warehouseDiscount, quantity, ...bookData } = row;
		bookFormData = bookData;
		editBookDialogOpen.set(true);
	};

	const openCustomItemForm = (row?: InventoryTableData<"custom"> & { key: string; rowIx: number }) => {
		if (row) {
			const { key, rowIx, __kind, ...bookData } = row;
			customItemFormData = bookData;
		}
		customItemDialogOpen.set(true);
	};

	const onBookFormUpdated: SuperForm<BookFormSchema>["options"]["onUpdated"] = async ({ form }) => {
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
			editBookDialogOpen.set(false);
		} catch (err) {
			// toastError(`Error: ${err.message}`);
		}
	};

	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(plugins);

	const onCustomItemUpdated: SuperForm<CustomItemFormSchema>["options"]["onUpdated"] = async ({ form }) => {
		/**
		 * This is a quick fix for `form.data` having all optional properties
		 *
		 * Unforuntately, Zod will not infer the correct `data` type from our schema unless we configure `strictNullChecks: true` in our TS config.
		 * Doing so however raises a mountain of "... potentially undefined" type errors throughout the codebase. It will take a significant amount of work
		 * to fix these properly.
		 *
		 * It is still safe to assume that the required properties of BookData are there, as the relative form controls are required
		 */
		const data = form?.data as NoteCustomItem;

		try {
			const newId = () => Math.trunc(Math.random() * 100_000);
			await upsertNoteCustomItem(db, noteId, { ...data, id: data.id ?? newId() });
			bookFormData = null;
			customItemDialogOpen.set(false);
		} catch (err) {
			console.error(err);
		}
	};
	// #endregion book-form

	$: breadcrumbs = noteId ? createBreadcrumbs("outbound", { id: noteId, displayName }) : [];

	// #region printing
	$: handlePrintReceipt = async () => {
		await printReceipt($deviceSettingsStore.receiptPrinterUrl, await getReceiptForNote(db, noteId));
	};
	$: handlePrintLabel = (book: Omit<BookData, "updatedAt">) => async () => {
		await printBookLabel($deviceSettingsStore.labelPrinterUrl, book);
	};

	let forceWithdrawalDialogRow: InventoryTableData<"book"> | null = null;

	const openForceWithdrawal = async (data: InventoryTableData<"book">) => {
		forceWithdrawalDialogRow = data;
	};

	const closeForceWithdrawal = () => {
		forceWithdrawalDialogRow = null;
	};

	// Create individual dialogs for each type
	const forceWithdrawalDialog = createDialog({ ...defaultDialogConfig });
	const {
		elements: { trigger: forceWithdrawalDialogTrigger, overlay: forceWithdrawalDialogOverlay, portalled: forceWithdrawalDialogPortalled },
		states: { open: forceWithdrawalDialogOpen }
	} = forceWithdrawalDialog;

	const deleteActionDialog = createDialog(defaultDialogConfig);
	const {
		elements: { trigger: deleteDialogTrigger, overlay: deleteDialogOverlay, portalled: deleteDialogPortalled },
		states: { open: deleteDialogOpen }
	} = deleteActionDialog;

	const editBookDialog = createDialog(defaultDialogConfig);
	const {
		elements: {
			trigger: editBookDialogTrigger,
			overlay: editBookDialogOverlay,
			content: editBookDialogContent,
			title: editBookDialogTitle,
			description: editBookDialogDescription,
			close: editBookDialogClose,
			portalled: editBookDialogPortalled
		},
		states: { open: editBookDialogOpen }
	} = editBookDialog;

	const customItemDialog = createDialog(defaultDialogConfig);
	const {
		elements: {
			trigger: customItemDialogTrigger,
			overlay: customItemDialogOverlay,
			content: customItemDialogContent,
			title: customItemDialogTitle,
			description: customItemDialogDescription,
			close: customItemDialogClose,
			portalled: customItemDialogPortalled
		},
		states: { open: customItemDialogOpen }
	} = customItemDialog;

	const confirmDialog = createDialog(defaultDialogConfig);
	const {
		elements: { overlay: confirmDialogOverlay, portalled: confirmDialogPortalled },
		states: { open: confirmDialogOpen }
	} = confirmDialog;
	let confirmDialogData: OutOfStockTransaction[] = [];

	const {
		elements: { trigger: popoverTrigger, content: popoverContent },
		states: { open: popoverOpen }
	} = createPopover({
		positioning: {
			placement: "right"
		}
	});
	// TODO: this is a duplicate
	const isBookRow = (data: InventoryTableData): data is InventoryTableData<"book"> => data.__kind !== "custom";

	const handleUpdateNoteWarehouse = async (warehouseId: number) => {
		await updateNote(db, noteId, { defaultWarehouse: warehouseId });
	};

	$: tOutbound = $LL.sale_note;
	$: tCommon = $LL.common;
</script>

<Page title={displayName} view="outbound-note" {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col divide-y">
		<div id="header" class="flex flex-col gap-y-4 px-6 py-4">
			<Breadcrumbs links={breadcrumbs} />
			<div class="flex w-full items-center justify-between">
				<div class="flex max-w-md flex-col">
					<TextEditable
						name="title"
						textEl="h1"
						textClassName="text-2xl font-bold leading-7 text-base-content"
						placeholder="Note"
						value={displayName}
						on:change={(e) => updateNote(db, noteId, { displayName: e.detail })}
					/>

					<div class="w-fit">
						{#if updatedAt}
							<span class="badge-primary badge-outline badge badge-md">
								{tOutbound.stats.last_updated()}: {generateUpdatedAtString(updatedAt)}
							</span>
						{/if}
					</div>
				</div>

				<div class="ml-auto flex items-center gap-x-2">
					<div>
						<button
							use:melt={$popoverTrigger}
							class="btn-primary btn-sm btn hidden xs:block"
							on:click={handleCommitSelfDryRun}
							on:keydown={handleCommitSelfDryRun}
						>
							<span class="button-text">{tOutbound.labels.commit()}</span>
						</button>
						<div>
							{#if $popoverOpen}
								<div
									data-testid={testId("popover-commit")}
									use:melt={$popoverContent}
									transition:fade={{
										duration: 100
									}}
									class=" z-10 rounded-lg bg-white shadow"
								>
									<p class="bg-error px-4 py-1">
										{tOutbound.alerts.no_warehouse_selected_commit_self()}
									</p>
								</div>
							{/if}
						</div>
					</div>
					<button on:click={() => handlePrint()} on:keydown={() => handlePrint()} class="btn-primary btn-sm btn hidden xs:block">
						{tCommon.actions.print()}
					</button>

					<DropdownWrapper let:item triggerLabel={tCommon.action_dropdown_trigger_aria()}>
						<div
							{...item}
							use:item.action
							on:click={handleCommitSelfDryRun}
							class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 text-base-content data-[highlighted]:bg-base-300 xs:hidden"
						>
							<FileCheck class="text-base-content/70" size={20} aria-hidden /><span class="text-base-content"
								>{tOutbound.labels.commit()}</span
							>
						</div>
						<div
							{...item}
							use:item.action
							on:m-click={handlePrintReceipt}
							class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 text-base-content data-[highlighted]:bg-base-300"
						>
							<Printer class="text-base-content/70" size={20} aria-hidden /><span class="text-base-content">{tOutbound.labels.print()}</span
							>
						</div>
						<div
							{...item}
							use:item.action
							use:melt={$deleteDialogTrigger}
							class="flex w-full items-center gap-2 bg-error px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-error/80"
						>
							<Trash2 class="text-error-content" size={20} aria-hidden /><span class="text-error-content">{tOutbound.labels.delete()}</span>
						</div>
					</DropdownWrapper>
				</div>
			</div>

			<div class="flex h-full flex-wrap items-center gap-2">
				<div class="flex grow items-center max-sm:w-full">
					<ScannerForm
						data={defaults(zod(scannerSchema))}
						options={{
							SPA: true,
							dataType: "json",
							validators: zod(scannerSchema),
							validationMethod: "submit-only",
							resetForm: true,
							onUpdated: async ({ form }) => {
								const { isbn } = form?.data;
								const warehouseId = await shouldAssignTransaction(isbn, 1);
								await handleAddTransaction(isbn, 1, warehouseId);
							}
						}}
						placeholder={tOutbound.placeholder.scan_title()}
					/>
					<select
						id="defaultWarehouse"
						name="defaultWarehouse"
						class="select-bordered select h-full"
						class:italic={!defaultWarehouse && warehouses.length > 0}
						value={defaultWarehouse || ""}
						on:change={(e) => handleUpdateNoteWarehouse(parseInt(e.currentTarget.value))}
					>
						<option value="">{warehouses.length > 0 ? tOutbound.placeholder.any_warehouse() : tOutbound.placeholder.no_warehouses()}</option
						>
						{#each warehouses as warehouse}
							<option class="not-italic" value={warehouse.id}>{warehouse.displayName}</option>
						{/each}
					</select>
				</div>
				<button
					use:melt={$customItemDialogTrigger}
					on:m-click={() => openCustomItemForm()}
					on:m-keydown={() => openCustomItemForm()}
					class="btn-neutral btn max-sm:btn-sm max-sm:w-full"
				>
					<Plus />
					{tOutbound.labels.custom_item()}</button
				>
			</div>
		</div>

		{#if loading}
			<div id="spinner" class="flex grow justify-center">
				<div class="mx-auto translate-y-1/2">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			</div>
		{:else if !entries.length}
			<div id="empty" class="flex grow justify-center">
				<div class="mx-auto max-w-xl translate-y-1/4">
					<!-- Start entity list placeholder -->
					<PlaceholderBox title={tOutbound.placeholder.scan_title()} description={tOutbound.placeholder.scan_description()}>
						<QrCode slot="icon" />
					</PlaceholderBox>
					<!-- End entity list placeholder -->
				</div>
			</div>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<OutboundTable
						{table}
						on:edit-row-quantity={({ detail: { event, row } }) => updateRowQuantity(event, row)}
						on:edit-row-warehouse={({ detail: { event, row } }) => updateRowWarehouse(row, event.detail.warehouseId)}
					>
						<div id="row-actions" slot="row-actions" let:row let:rowIx>
							{@const editTrigger = isBookRow(row) ? $editBookDialogTrigger : $customItemDialogTrigger}

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
									<span class="sr-only">{tOutbound.labels.edit_row()} {rowIx}</span>
									<span class="aria-hidden">
										<MoreVertical />
									</span>
								</button>

								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div slot="popover-content" data-testid={testId("popover-container")} class="bg-secondary">
									<button
										use:melt={editTrigger}
										class="btn-secondary btn-sm btn"
										data-testid={testId("edit-row")}
										on:m-click={handleOpenFormPopover(row)}
										on:m-keydown={handleOpenFormPopover(row)}
									>
										<span class="sr-only">{tOutbound.labels.edit_row()} {rowIx}</span>
										<span class="aria-hidden">
											<FileEdit />
										</span>
									</button>

									{#if isBookRow(row)}
										<button class="btn-secondary btn-sm btn" data-testid={testId("print-book-label")} on:click={handlePrintLabel(row)}>
											<span class="sr-only">{tOutbound.labels.print_book_label()} {rowIx}</span>
											<span class="aria-hidden">
												<Printer />
											</span>
										</button>
									{/if}

									<button on:click={deleteRow(rowIx)} class="btn-secondary btn-sm btn" data-testid={testId("delete-row")}>
										<span class="sr-only">{tOutbound.labels.delete_row()} {rowIx}</span>
										<span class="aria-hidden">
											<Trash2 />
										</span>
									</button>
								</div>
							</PopoverWrapper>
						</div>
						<svelte:fragment slot="warehouse-select" let:editWarehouse let:row let:rowIx>
							{#if isBookRow(row)}
								<WarehouseSelect
									scannedQuantitiesPerWarehouse={bookRows.get(row.isbn)}
									{row}
									{rowIx}
									on:change={(event) => editWarehouse(event, row)}
								>
									<button
										let:open
										use:melt={$forceWithdrawalDialogTrigger}
										class="btn-ghost btn-sm btn w-full justify-start rounded border-0"
										slot="force-withdrawal"
										data-testid={testId("force-withdrawal-button")}
										on:m-click={() => {
											openForceWithdrawal(row);
											open.set(false);
										}}
									>
										{tOutbound.labels.force_withdrawal()}
									</button>
								</WarehouseSelect>
							{/if}
						</svelte:fragment>
					</OutboundTable>
				</div>

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if entries?.length > maxResults}
					<div use:scroll.trigger></div>
				{/if}
			</div>
		{/if}
	</div>
</Page>

{#if $forceWithdrawalDialogOpen && forceWithdrawalDialogRow}
	<div use:melt={$forceWithdrawalDialogPortalled}>
		<div use:melt={$forceWithdrawalDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}></div>

		<ForceWithdrawalDialog
			dialog={forceWithdrawalDialog}
			row={forceWithdrawalDialogRow}
			{warehouses}
			{bookRows}
			onSave={(row, warehouseId) => updateRowWarehouse(row, warehouseId)}
			onCancel={() => closeForceWithdrawal()}
		/>
	</div>
{/if}

{#if $deleteDialogOpen}
	<div use:melt={$deleteDialogPortalled}>
		<div use:melt={$deleteDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}></div>
		<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
			<Dialog dialog={deleteActionDialog} type="delete" onConfirm={handleDeleteSelf}>
				<svelte:fragment slot="title">{tCommon.delete_dialog.title({ entity: displayName })}</svelte:fragment>
				<svelte:fragment slot="description">{tCommon.delete_dialog.description()}</svelte:fragment>
			</Dialog>
		</div>
	</div>
{/if}

{#if $confirmDialogOpen}
	{@const totalAvailableStockBookCount = bookEntries
		.filter(isBookRow)
		.filter((book) => {
			return book.type === "normal";
		})
		.reduce((acc, { quantity }) => acc + quantity, 0)}
	<div use:melt={$confirmDialogPortalled}>
		<div use:melt={$confirmDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}></div>
		<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
			<Dialog dialog={confirmDialog} type="delete" onConfirm={handleReconcileAndCommitSelf(confirmDialogData)}>
				<svelte:fragment slot="title">{tOutbound.commit_dialog.title({ entity: displayName })}</svelte:fragment>
				<svelte:fragment slot="description">
					{#if totalAvailableStockBookCount > 0}
						{tOutbound.commit_dialog.description({ bookCount: totalAvailableStockBookCount })}
					{/if}
				</svelte:fragment>

				{#if confirmDialogData.length}
					<details>
						<summary class="mb-2 mt-4">
							{tOutbound.commit_dialog.stock_adjustement_detail.summary()}
						</summary>
						<ul class="list-disc px-5">
							{#each confirmDialogData as { isbn, warehouseName, quantity, available }}
								<li class="pl-2">
									<span class="font-semibold"
										>{tOutbound.commit_dialog.stock_adjustement_detail.detail_list.row({ isbn, warehouse: warehouseName })}</span
									>

									<ul class="mb-2">
										<li class="pl-2">{tOutbound.commit_dialog.stock_adjustement_detail.detail_list.requested({ quantity: quantity })}</li>
										<li class="pl-2">{tOutbound.commit_dialog.stock_adjustement_detail.detail_list.available({ quantity: available })}</li>
										<li class="pl-2 font-semibold">
											{tOutbound.commit_dialog.stock_adjustement_detail.detail_list.adjustment({ quantity: quantity - available })}
										</li>
									</ul>
								</li>
							{/each}
						</ul>
					</details>
				{/if}
			</Dialog>
		</div>
	</div>
{/if}

{#if $editBookDialogOpen}
	<div use:melt={$editBookDialogPortalled}>
		<div use:melt={$editBookDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}></div>
		<div
			use:melt={$editBookDialogContent}
			class="divide-y-secondary fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 divide-y overflow-y-auto
			bg-base-200 shadow-lg focus:outline-none"
			in:fly|global={{
				x: 350,
				duration: 300,
				opacity: 1
			}}
			out:fly|global={{
				x: 350,
				duration: 100
			}}
		>
			<div class="flex w-full flex-row justify-between bg-base-200 p-6">
				<div>
					<h2 use:melt={$editBookDialogTitle} class="text-lg font-medium">{tCommon.edit_book_dialog.title()}</h2>
					<p use:melt={$editBookDialogDescription} class="leading-normal">
						{tCommon.edit_book_dialog.description()}
					</p>
				</div>
				<button use:melt={$editBookDialogClose} aria-label="Close" class="btn-neutral btn-outline btn-md btn">
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
						onUpdated: onBookFormUpdated
					}}
					onCancel={() => editBookDialogOpen.set(false)}
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

{#if $customItemDialogOpen}
	<div use:melt={$customItemDialogPortalled}>
		<div use:melt={$customItemDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}></div>
		<div
			use:melt={$customItemDialogContent}
			class="divide-y-secondary fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 divide-y overflow-y-auto
			bg-base-200 shadow-lg focus:outline-none"
			in:fly|global={{
				x: 350,
				duration: 300,
				opacity: 1
			}}
			out:fly|global={{
				x: 350,
				duration: 100
			}}
		>
			<div class="flex w-full flex-row justify-between bg-base-200 p-6">
				<div>
					<h2 use:melt={$customItemDialogTitle} class="text-lg font-medium">
						{customItemFormData ? tOutbound.edit_custom_item_dialog.title() : tOutbound.create_custom_item_dialog.title()}
					</h2>
					<p use:melt={$customItemDialogDescription} class="leading-normal">
						<!-- TODO: no string for this -->
					</p>
				</div>
				<button use:melt={$customItemDialogClose} aria-label="Close" class="btn-neutral btn-outline btn-md btn">
					<X size={16} />
				</button>
			</div>
			<div class="px-6">
				<CustomItemForm
					data={defaults(customItemFormData, zod(customItemSchema))}
					options={{
						SPA: true,
						dataType: "json",
						validators: zod(customItemSchema),
						validationMethod: "submit-only",
						onUpdated: onCustomItemUpdated
					}}
					onCancel={() => customItemDialogOpen.set(false)}
				/>
			</div>
		</div>
	</div>
{/if}

<style>
	@media print {
		#header {
			display: none;
		}
		#spinner {
			display: none;
		}
		#row-actions {
			display: none;
		}
		#empty {
			display: none;
		}
		#button-container {
			display: none;
		}
	}
</style>
