<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade, fly } from "svelte/transition";
	import { writable, readable } from "svelte/store";
	import { invalidate } from "$app/navigation";
	import { filter, scan } from "rxjs";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { Printer, QrCode, Trash2, FileEdit, MoreVertical, X, Loader2 as Loader, FileCheck, Plus } from "lucide-svelte";

	import { desc, testId } from "@librocco/shared";
	import { type BookData } from "@librocco/shared";

	import type { PageData } from "./$types";
	import type { VolumeStock, OutOfStockTransaction, NoteCustomItem } from "$lib/db/cr-sqlite/types";

	import { OutOfStockError, NoWarehouseSelectedError } from "$lib/db/cr-sqlite/errors";

	import {
		Breadcrumbs,
		DropdownWrapper,
		PopoverWrapper,
		Page,
		PlaceholderBox,
		createBreadcrumbs,
		Dialog,
		OutboundTable,
		TextEditable,
		type WarehouseChangeDetail,
		ExtensionAvailabilityToast
	} from "$lib/components";
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
		createAndCommitReconciliationNote,
		createOutboundNote,
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

	import { racefreeGoto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";
	import LL from "@librocco/shared/i18n-svelte";
	import { getStock } from "$lib/db/cr-sqlite/stock";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload when note
		const disposer1 = rx.onPoint("note", BigInt(data.id), () => invalidate("note:data"));
		// Reload when entries (book/custom item) change
		const disposer2 = rx.onRange(["book", "book_transaction", "custom_item", "warehouse"], () => invalidate("note:books"));
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data.dbCtx?.db;

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !db;

	$: noteId = data.id;
	$: displayName = data.displayName;
	$: defaultWarehouse = data.defaultWarehouse;

	$: warehouses = data.warehouses;

	$: updatedAt = data.updatedAt;
	$: bookEntries = data.entries.map((e) => ({ __kind: "book", ...e })) as InventoryTableData[];
	$: totalBookCount = bookEntries.filter(isBookRow).reduce((acc, { quantity }) => acc + quantity, 0);
	$: customItemEntries = data.customItems.map((e) => ({ __kind: "custom", ...e })) as InventoryTableData[];
	$: publisherList = data.publisherList;

	$: plugins = data.plugins;

	// Defensive programming: updatedAt will fall back to 0 (items witout updatedAt displayed at the bottom) - this shouldn't really happen (here for type consistency)
	$: entries = bookEntries.concat(customItemEntries).sort(desc((x) => Number(x.updatedAt || 0)));

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll

	// #region table
	const tableOptions = writable({ data: entries?.slice(0, maxResults) });
	const table = createTable(tableOptions);
	$: tableOptions.set({ data: entries?.slice(0, maxResults) });
	// #endregion table

	// #region note-actions
	const openNoWarehouseSelectedDialog = (invalidTransactions: VolumeStock[]) => {
		dialogContent = {
			type: "no-warehouse-selected",
			invalidTransactions
		};
		open.set(true);
	};

	const openReconciliationDialog = (invalidTransactions: OutOfStockTransaction[]) => {
		dialogContent = {
			type: "reconcile",
			invalidTransactions
		};
		open.set(true);
	};

	const handleCommitSelf = async (closeDialog: () => void) => {
		try {
			await commitNote(db, noteId);
			closeDialog();
		} catch (err) {
			if (err instanceof NoWarehouseSelectedError) {
				return openNoWarehouseSelectedDialog(err.invalidTransactions);
			}
			if (err instanceof OutOfStockError) {
				return openReconciliationDialog(err.invalidTransactions);
			}
			throw err;
		}
	};

	const handleReconcileAndCommitSelf = (invalidTransactions: OutOfStockTransaction[]) => async (closeDialog: () => void) => {
		// TODO: this should probably be wrapped in a txn, but doing so resulted in app freezing at this point
		const id = await getNoteIdSeq(db);
		await createAndCommitReconciliationNote(
			db,
			id,
			invalidTransactions.map(({ quantity, available, ...txn }) => ({ ...txn, quantity: quantity - available }))
		);
		await commitNote(db, noteId);
		closeDialog();
	};

	const handleDeleteSelf = async (closeDialog: () => void) => {
		await deleteNote(db, noteId);
		closeDialog();
	};
	// #region note-actions

	// #region transaction-actions
	const handleAddTransaction = async (isbn: string) => {
		const stock = await getStock(db, { isbns: [isbn] });

		const warehouseOptions = stock.map((st) => ({ warehouseId: st.warehouseId, warehouseName: st.warehouseName }));

		if (warehouseOptions.length === 1) {
			await addVolumesToNote(db, noteId, { isbn, quantity: 1, warehouseId: warehouseOptions[0].warehouseId });
		} else if ((!warehouseOptions.length && defaultWarehouse) || warehouseOptions.find((wo) => wo.warehouseId === defaultWarehouse)) {
			await addVolumesToNote(db, noteId, { isbn, quantity: 1, warehouseId: defaultWarehouse });
		} else {
			await addVolumesToNote(db, noteId, { isbn, quantity: 1 });
		}

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

		await updateNoteTxn(db, noteId, transaction, { ...transaction, quantity: nextQty });
	};

	const updateRowWarehouse = async (e: CustomEvent<WarehouseChangeDetail>, data: InventoryTableData<"book">) => {
		const { isbn, quantity, warehouseId: currentWarehouseId } = data;
		const { warehouseId: nextWarehouseId } = e.detail;
		// Number form control validation means this string->number conversion should yield a valid result
		const transaction = { isbn, warehouseId: currentWarehouseId, quantity };

		// Block identical updates (with respect to the existing state) as they might cause an feedback loop when connected to the live db.
		if (currentWarehouseId === nextWarehouseId) {
			return;
		}

		await updateNoteTxn(db, noteId, { isbn, warehouseId: currentWarehouseId }, { quantity, warehouseId: nextWarehouseId });
	};

	const deleteRow = (rowIx: number) => async () => {
		const row = entries[rowIx];
		if (isBookRow(row)) {
			const { isbn, warehouseId } = row;
			await removeNoteTxn(db, noteId, { isbn, warehouseId });
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
	const handleOpenFormPopover = (row: InventoryTableData & { key: string; rowIx: number }) => () =>
		isBookRow(row) ? openBookForm(row) : openCustomItemForm(row);

	const openBookForm = (row: InventoryTableData<"book"> & { key: string; rowIx: number }) => {
		// eslint-disable-next-line
		// @ts-ignore `__kind` does still exist on the row data here. Types are convulted & misaligned with data
		// this was causing errors when passing the data to the book form.
		const { key, rowIx, __kind, availableWarehouses, warehouseId, warehouseName, warehouseDiscount, quantity, ...bookData } = row;
		bookFormData = bookData;

		dialogContent = {
			onConfirm: () => {},
			title: tCommon.edit_book_dialog.title(),
			description: tCommon.edit_book_dialog.description(),
			type: "edit-row"
		};
	};

	const openCustomItemForm = (row?: InventoryTableData<"custom"> & { key: string; rowIx: number }) => {
		if (row) {
			const { key, rowIx, __kind, ...bookData } = row;
			customItemFormData = bookData;
		}

		dialogContent = {
			onConfirm: () => {},
			title: row ? tCommon.edit_custom_item_dialog.title() : tCommon.create_custom_item_dialog.title(),
			description: "",
			type: "custom-item-form"
		};
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
			open.set(false);
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
			open.set(false);
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

	const dialog = createDialog({
		forceVisible: true
	});
	const {
		elements: { trigger: dialogTrigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = dialog;

	let dialogContent:
		| ({ type: "commit" | "delete" | "edit-row" | "custom-item-form" } & DialogContent)
		| { type: "no-warehouse-selected"; invalidTransactions: VolumeStock[] }
		| { type: "reconcile"; invalidTransactions: OutOfStockTransaction[] };

	// TODO: this is a duplicate
	const isBookRow = (data: InventoryTableData): data is InventoryTableData<"book"> => data.__kind !== "custom";

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateOutboundNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);
		await goto(appPath("outbound", id));
	};

	const handleUpdateNoteWarehouse = async (warehouseId: number) => {
		await updateNote(db, noteId, { defaultWarehouse: warehouseId });
	};

	$: tOutbound = $LL.outbound_note;
	$: tCommon = $LL.common;
</script>

<Page {handleCreateOutboundNote} view="outbound-note" loaded={!loading}>
	<svelte:fragment slot="topbar" let:iconProps>
		<QrCode {...iconProps} />
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
					await handleAddTransaction(isbn);
				}
			}}
		/>
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<div class="flex w-full items-center justify-between">
			<div class="flex max-w-md flex-col">
				<TextEditable
					name="title"
					textEl="h1"
					textClassName="text-2xl font-bold leading-7 text-gray-900"
					placeholder="Note"
					value={displayName}
					on:change={(e) => updateNote(db, noteId, { displayName: e.detail })}
				/>

				<div class="w-fit">
					{#if updatedAt}
						<span class="badge badge-md badge-green">{tOutbound.stats.last_updated()}: {generateUpdatedAtString(updatedAt)}</span>
					{/if}
				</div>
			</div>

			<div class="ml-auto flex items-center gap-x-2">
				<div class="flex flex-col">
					<select
						id="defaultWarehouse"
						name="defaultWarehouse"
						class="flex w-full gap-x-2 rounded border-2 border-gray-500 bg-white p-2 shadow focus:border-teal-500 focus:outline-none focus:ring-0"
						value={defaultWarehouse || ""}
						disabled={!warehouses.length}
						on:change={(e) => handleUpdateNoteWarehouse(parseInt(e.currentTarget.value))}
					>
						<option value=""
							>{warehouses.length > 0 ? tOutbound.placeholder.select_warehouse() : tOutbound.placeholder.no_warehouses()}</option
						>

						{#each warehouses as warehouse}
							<option value={warehouse.id}>{warehouse.displayName}</option>
						{/each}
					</select>
				</div>
				<button
					class="button button-green hidden xs:block"
					use:melt={$dialogTrigger}
					on:m-click={() => {
						dialogContent = {
							onConfirm: handleCommitSelf,
							title: tCommon.commit_outbound_dialog.title({ entity: displayName }),
							description: tCommon.commit_outbound_dialog.description({ bookCount: totalBookCount }),
							type: "commit"
						};
					}}
					on:m-keydown={() => {
						dialogContent = {
							onConfirm: handleCommitSelf,
							title: tCommon.commit_outbound_dialog.title({ entity: displayName }),
							description: tCommon.commit_outbound_dialog.description({ bookCount: totalBookCount }),
							type: "commit"
						};
					}}
				>
					<span class="button-text">Commit</span>
				</button>

				<DropdownWrapper let:item>
					<div
						{...item}
						use:item.action
						use:melt={$dialogTrigger}
						on:m-click={() => {
							dialogContent = {
								onConfirm: handleCommitSelf,
								title: tCommon.commit_outbound_dialog.title({ entity: displayName }),
								description: tCommon.commit_outbound_dialog.description({ bookCount: totalBookCount }),
								type: "commit"
							};
						}}
						class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-gray-100 xs:hidden"
					>
						<FileCheck class="text-gray-400" size={20} /><span class="text-gray-700">Commit</span>
					</div>
					<div
						{...item}
						use:item.action
						on:m-click={handlePrintReceipt}
						class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-gray-100"
					>
						<Printer class="text-gray-400" size={20} /><span class="text-gray-700">Print</span>
					</div>
					<div
						{...item}
						use:item.action
						use:melt={$dialogTrigger}
						class="flex w-full items-center gap-2 bg-red-400 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-red-500"
						on:m-click={() => {
							dialogContent = {
								onConfirm: handleDeleteSelf,
								title: tCommon.delete_dialog.title({ entity: displayName }),
								description: tCommon.delete_dialog.description(),
								type: "delete"
							};
						}}
						on:m-keydown={() => {
							dialogContent = {
								onConfirm: handleDeleteSelf,
								title: tCommon.delete_dialog.title({ entity: displayName }),
								description: tCommon.delete_dialog.description(),
								type: "delete"
							};
						}}
					>
						<Trash2 class="text-white" size={20} /><span class="text-white">{tOutbound.labels.delete()}</span>
					</div>
				</DropdownWrapper>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if loading}
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else if !entries.length}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<PlaceholderBox title="Scan to add books" description="Plugin your barcode scanner and pull the trigger" class="center-absolute">
					<QrCode slot="icon" let:iconProps {...iconProps} />
				</PlaceholderBox>

				<div class="flex h-24 w-full items-center justify-start px-8">
					<button
						use:melt={$dialogTrigger}
						on:m-click={() => openCustomItemForm()}
						on:m-keydown={() => openCustomItemForm()}
						class="button button-white"><Plus /> Custom item</button
					>
				</div>
			</div>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<OutboundTable
						{table}
						warehouseList={warehouses}
						on:edit-row-quantity={({ detail: { event, row } }) => updateRowQuantity(event, row)}
						on:edit-row-warehouse={({ detail: { event, row } }) => updateRowWarehouse(event, row)}
					>
						<div slot="row-actions" let:row let:rowIx>
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
									<span class="sr-only">{tOutbound.labels.edit_row()} {rowIx}</span>
									<span class="aria-hidden">
										<MoreVertical />
									</span>
								</button>

								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div slot="popover-content" data-testid={testId("popover-container")} class="rounded bg-gray-900">
									<button
										use:melt={$dialogTrigger}
										class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
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
										<button
											class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
											data-testid={testId("print-book-label")}
											on:click={handlePrintLabel(row)}
										>
											<span class="sr-only">{tOutbound.labels.print_book_label()} {rowIx}</span>
											<span class="aria-hidden">
												<Printer />
											</span>
										</button>
									{/if}

									<button
										on:click={deleteRow(rowIx)}
										class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
										data-testid={testId("delete-row")}
									>
										<span class="sr-only">{tOutbound.labels.delete_row()} {rowIx}</span>
										<span class="aria-hidden">
											<Trash2 />
										</span>
									</button>
								</div>
							</PopoverWrapper>
						</div>
					</OutboundTable>
				</div>

				<div class="flex h-24 w-full items-center justify-start px-8">
					<button
						use:melt={$dialogTrigger}
						on:m-click={() => openCustomItemForm()}
						on:m-keydown={() => openCustomItemForm()}
						class="button button-white"><Plus /> Custom item</button
					>
				</div>

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if entries?.length > maxResults}
					<div use:scroll.trigger></div>
				{/if}
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast {plugins} />
	</svelte:fragment>
</Page>

{#if $open}
	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}></div>
		{#if dialogContent.type === "no-warehouse-selected"}
			<!-- No warehouse selecter dialog -->
			{@const { invalidTransactions } = dialogContent}

			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} type="delete" onConfirm={() => {}}>
					<svelte:fragment slot="title">{tCommon.no_warehouse_dialog.title()}</svelte:fragment>
					<svelte:fragment slot="description">{tCommon.no_warehouse_dialog.description()}</svelte:fragment>
					<h3 class="mb-2 mt-4 font-semibold">{tOutbound.delete_dialog.select_warehouse()}:</h3>
					<ul class="pl-2">
						{#each invalidTransactions as { isbn }}
							<li>{isbn}</li>
						{/each}
					</ul>
					<!-- A small hack to hide the 'Confirm' button as there's nothing to confirm -->
					<svelte:fragment slot="confirm-button"><span></span></svelte:fragment>
				</Dialog>
			</div>
			<!-- No warehouse selecter dialog end -->
		{:else if dialogContent.type === "reconcile"}
			<!-- Note reconciliation dialog -->
			{@const { invalidTransactions } = dialogContent}

			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} type="delete" onConfirm={handleReconcileAndCommitSelf(invalidTransactions)}>
					<svelte:fragment slot="title">{tCommon.reconcile_outbound_dialog.title()}</svelte:fragment>
					<svelte:fragment slot="description">{tCommon.reconcile_outbound_dialog.description()}</svelte:fragment>
					<h3 class="mb-2 mt-4 font-semibold">{tOutbound.reconcile_dialog.review_transaction()}:</h3>
					<ul class="pl-2">
						{#each invalidTransactions as { isbn, warehouseName, quantity, available }}
							<li class="mb-2">
								<p><span class="font-semibold">{isbn}</span> in <span class="font-semibold">{warehouseName}:</span></p>
								<p class="pl-2">requested quantity: {quantity}</p>
								<p class="pl-2">available: {available}</p>
								<p class="pl-2">
									{tOutbound.reconcile_dialog.quantity()}: <span class="font-semibold">{quantity - available}</span>
								</p>
							</li>
						{/each}
					</ul>
				</Dialog>
			</div>
			<!-- Note reconciliation dialog end -->
		{:else if dialogContent.type === "edit-row"}
			<div
				use:melt={$content}
				class="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 overflow-y-auto bg-white
				shadow-lg focus:outline-none"
				in:fly|global={{
					x: 350,
					duration: 150,
					opacity: 1
				}}
				out:fly|global={{
					x: 350,
					duration: 100
				}}
			>
				<div class="flex w-full flex-row justify-between bg-gray-50 px-6 py-4">
					<div>
						<h2 use:melt={$title} class="mb-0 text-lg font-medium text-black">{tCommon.edit_book_dialog.title()}</h2>
						<p use:melt={$description} class="mb-5 mt-2 leading-normal text-zinc-600">{tCommon.edit_book_dialog.description()}</p>
					</div>
					<button use:melt={$close} aria-label="Close" class="self-start rounded p-3 text-gray-500 hover:text-gray-900">
						<X class="square-4" />
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
		{:else if dialogContent.type === "custom-item-form"}
			{@const { title: dialogTitle, description: dialogDescription } = dialogContent}

			<div
				use:melt={$content}
				class="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 overflow-y-auto bg-white
				shadow-lg focus:outline-none"
				in:fly|global={{
					x: 350,
					duration: 150,
					opacity: 1
				}}
				out:fly|global={{
					x: 350,
					duration: 100
				}}
			>
				<div class="flex w-full flex-row justify-between bg-gray-50 px-6 py-4">
					<div>
						<h2 use:melt={$title} class="mb-0 text-lg font-medium text-black">{dialogTitle}</h2>
						<p use:melt={$description} class="mb-5 mt-2 leading-normal text-zinc-600">{dialogDescription}</p>
					</div>
					<button use:melt={$close} aria-label="Close" class="self-start rounded p-3 text-gray-500 hover:text-gray-900">
						<X class="square-4" />
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
						onCancel={() => open.set(false)}
					/>
				</div>
			</div>
		{:else}
			{@const { type, title: dialogTitle, description: dialogDescription } = dialogContent}

			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} {type} onConfirm={dialogContent.onConfirm}>
					<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
					<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>
				</Dialog>
			</div>
		{/if}
	</div>
{/if}
