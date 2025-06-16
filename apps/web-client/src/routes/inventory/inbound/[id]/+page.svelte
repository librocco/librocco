<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade, fly } from "svelte/transition";
	import { writable } from "svelte/store";
	import { invalidate } from "$app/navigation";
	import { filter, scan } from "rxjs";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { Printer, QrCode, Trash2, FileEdit, MoreVertical, X, FileCheck } from "lucide-svelte";

	import { testId } from "@librocco/shared";
	import type { BookData } from "@librocco/shared";

	import type { PageData } from "./$types";
	import type { InventoryTableData } from "$lib/components/Tables/types";

	import {
		Breadcrumbs,
		DropdownWrapper,
		PopoverWrapper,
		PlaceholderBox,
		createBreadcrumbs,
		TextEditable,
		Dialog,
		InboundTable
	} from "$lib/components";
	import { Page } from "$lib/controllers";
	import { defaultDialogConfig } from "$lib/components/Melt";

	import { BookForm, bookSchema, ScannerForm, scannerSchema, type BookFormSchema } from "$lib/forms";

	import { printBookLabel, printReceipt } from "$lib/printer";

	import { type DialogContent } from "$lib/types";
	import { createExtensionAvailabilityStore } from "$lib/stores";
	import { autoPrintLabels, deviceSettingsStore } from "$lib/stores/app";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { mergeBookData } from "$lib/utils/misc";

	import {
		addVolumesToNote,
		commitNote,
		deleteNote,
		getReceiptForNote,
		removeNoteTxn,
		updateNote,
		updateNoteTxn
	} from "$lib/db/cr-sqlite/note";
	import { getBookData, upsertBook } from "$lib/db/cr-sqlite/books";
	import type { NoteEntriesItem } from "$lib/db/cr-sqlite/types";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	$: ({ plugins, id: noteId, warehouseId, warehouseName, displayName, updatedAt, publisherList } = data);
	$: db = data.dbCtx?.db;

	$: t = $LL.inventory_page.purchase_tab;
	$: tInbound = $LL.purchase_note;
	$: tCommon = $LL.common;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload when note
		const disposer1 = data.dbCtx?.rx?.onPoint("note", BigInt(data.id), () => invalidate("note:data"));
		// Reload when entries change
		const disposer2 = data.dbCtx?.rx?.onRange(["book", "book_transaction"], () => invalidate("note:books"));
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !db;

	$: entries = data.entries as NoteEntriesItem[];
	$: totalBookCount = entries.reduce((acc, { quantity }) => acc + quantity, 0);

	const handleCommitSelf = async (closeDialog: () => void) => {
		await commitNote(db, noteId);
		closeDialog();
	};

	const handleDeleteSelf = async (closeDialog: () => void) => {
		await deleteNote(db, noteId);
		closeDialog();
	};

	const handlePrint = () => {
		window.print();
	};

	// #region note-actions

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll

	// #region table
	// * NOTE: removing __kind from entries helps align data & types in table interfaces.
	// This is convulted.
	// It was causing errors when passing a row to the edit form
	const tableOptions = writable({ data: entries?.slice(0, maxResults) });
	const table = createTable(tableOptions);
	$: tableOptions.set({ data: entries?.slice(0, maxResults) });
	// #endregion table

	// #region transaction-actions
	const handleAddTransaction = async (isbn: string) => {
		await addVolumesToNote(db, noteId, { isbn, quantity: 1, warehouseId });

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

	const updateRowQuantity = async (e: SubmitEvent, { isbn, warehouseId, quantity: currentQty }: InventoryTableData<"book">) => {
		const data = new FormData(e.currentTarget as HTMLFormElement);
		// Number form control validation means this string->number conversion should yield a valid result
		const nextQty = Number(data.get("quantity"));

		const transaction = { isbn, warehouseId };

		if (currentQty == nextQty) {
			return;
		}

		await updateNoteTxn(db, noteId, transaction, { ...transaction, quantity: nextQty });
	};

	const deleteRow = async (isbn: string, warehouseId: number) => {
		await removeNoteTxn(db, noteId, { isbn, warehouseId });
	};
	// #region transaction-actions

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
			editDialogOpen.set(false);
		} catch (err) {
			// toastError(`Error: ${err.message}`);
		}
	};

	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(plugins);

	// #region printing
	$: handlePrintReceipt = async () => {
		await printReceipt($deviceSettingsStore.receiptPrinterUrl, await getReceiptForNote(db, noteId));
	};
	$: handlePrintLabel = async (book: BookData) => {
		await printBookLabel($deviceSettingsStore.labelPrinterUrl, book);
	};
	// #endregion book-form

	$: breadcrumbs =
		noteId && warehouseId ? createBreadcrumbs("inbound", { id: warehouseId, displayName: warehouseName }, { id: noteId, displayName }) : [];

	const editBookDialog = createDialog(defaultDialogConfig);
	const {
		elements: {
			trigger: editDialogTrigger,
			overlay: editDialogOverlay,
			content: editDialogContent,
			title: editDialogTitle,
			description: editDialogDescription,
			close: editDialogClose,
			portalled: editDialogPortalled
		},
		states: { open: editDialogOpen }
	} = editBookDialog;

	const confirmActionDialog = createDialog(defaultDialogConfig);
	const {
		elements: {
			trigger: confirmDialogTrigger,
			overlay: confirmDialogOverlay,

			portalled: confirmDialogPortalled
		},
		states: { open: confirmDialogOpen }
	} = confirmActionDialog;

	let dialogContent: DialogContent & { type: "commit" | "delete" };
</script>

<Page title={displayName} view="inbound-note" {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col divide-y">
		<div id="inbound-header" class="flex flex-col gap-y-4 px-6 py-4">
			<Breadcrumbs links={breadcrumbs} />
			<div class="flex w-full flex-wrap items-center justify-between gap-2">
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
							<span class="primary badge-outline badge badge-md">{t.stats.last_updated()}: {generateUpdatedAtString(updatedAt)}</span>
						{/if}
					</div>
				</div>

				<div class="ml-auto flex items-center gap-x-2">
					<button
						class="btn-primary btn-sm btn hidden xs:block"
						use:melt={$confirmDialogTrigger}
						on:m-click={() => {
							dialogContent = {
								onConfirm: handleCommitSelf,
								title: tCommon.commit_purchase_dialog.title({ entity: displayName }),
								description: tCommon.commit_purchase_dialog.description({ bookCount: totalBookCount, warehouseName }),
								type: "commit"
							};
						}}
						on:m-keydown={() => {
							dialogContent = {
								onConfirm: handleCommitSelf,
								title: tCommon.commit_purchase_dialog.title({ entity: displayName }),
								description: tCommon.commit_purchase_dialog.description({ bookCount: totalBookCount, warehouseName }),
								type: "commit"
							};
						}}
					>
						<span class="button-text">{tInbound.labels.commit()}</span>
					</button>
					<button class="btn-neutral btn-sm btn hidden xs:block" on:click={handlePrint} aria-label="Print Table">
						<span class="button-text ml-1">Print Table</span>
					</button>

					<DropdownWrapper let:item>
						<div
							{...item}
							use:item.action
							use:melt={$confirmDialogTrigger}
							on:m-click={() => {
								dialogContent = {
									onConfirm: handleCommitSelf,
									title: tCommon.commit_sale_dialog.title({ entity: displayName }),
									description: tCommon.commit_sale_dialog.description({ bookCount: totalBookCount }),
									type: "commit"
								};
							}}
							class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 text-base-content data-[highlighted]:bg-base-300 xs:hidden"
						>
							<FileCheck class="text-base-content/70" size={20} /><span class="text-base-content">{tInbound.labels.commit()}</span>
						</div>
						<div
							{...item}
							use:item.action
							on:m-click={handlePrintReceipt}
							class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 text-base-content data-[highlighted]:bg-base-300"
						>
							<Printer class="text-base-content/70" size={20} /><span class="text-base-content">{tInbound.labels.print()}</span>
						</div>
						<div
							{...item}
							use:item.action
							on:m-click={autoPrintLabels.toggle}
							class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 text-base-content data-[highlighted]:bg-base-300 {$autoPrintLabels
								? '!bg-success text-success-content'
								: ''}"
						>
							<Printer class="text-base-content/70" size={20} />
							<span class="text-base-content">
								{tInbound.labels.auto_print_book_labels()}
							</span>
						</div>
						<div
							{...item}
							use:item.action
							use:melt={$confirmDialogTrigger}
							class="flex w-full items-center gap-2 bg-error px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-error/80"
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
							<Trash2 class="text-error-content" size={20} /><span class="text-error-content">{tInbound.labels.delete()}</span>
						</div>
					</DropdownWrapper>
				</div>
			</div>
			<div class="flex w-full py-4">
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

							if ($autoPrintLabels) {
								try {
									getBookData(db, isbn).then(handlePrintLabel);
									// Success
								} catch (err) {
									// Show error
								}
							}
						}
					}}
				/>
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
					<PlaceholderBox title="Scan to add books" description="Plugin your barcode scanner and pull the trigger">
						<QrCode slot="icon" />
					</PlaceholderBox>
					<!-- End entity list placeholder -->
				</div>
			</div>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<InboundTable {table} on:edit-row-quantity={({ detail: { event, row } }) => updateRowQuantity(event, row)}>
						<div id="row-actions" slot="row-actions" let:row let:rowIx>
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
									<span class="sr-only">Edit row {rowIx}</span>
									<span class="aria-hidden">
										<MoreVertical />
									</span>
								</button>

								<div slot="popover-content" data-testid={testId("popover-container")} class="bg-secondary">
									<button
										use:melt={$editDialogTrigger}
										class="btn-secondary btn-sm btn"
										data-testid={testId("edit-row")}
										on:m-click={() => {
											const { warehouseId, quantity, ...bookData } = row;

											bookFormData = bookData;
										}}
										on:m-keydown={() => {
											const { warehouseId, quantity, ...bookData } = row;
											bookFormData = bookData;
										}}
									>
										<span class="sr-only">{tInbound.labels.edit_row()} {rowIx}</span>
										<span class="aria-hidden">
											<FileEdit />
										</span>
									</button>

									<button class="btn-secondary btn-sm btn" data-testid={testId("print-book-label")} on:click={() => handlePrintLabel(row)}>
										<span class="sr-only">{tInbound.labels.print_book_label()} {rowIx}</span>
										<span class="aria-hidden">
											<Printer />
										</span>
									</button>

									<button
										on:click={() => deleteRow(row.isbn, row.warehouseId)}
										class="btn-secondary btn-sm btn"
										data-testid={testId("delete-row")}
									>
										<span class="sr-only">{tInbound.labels.delete_row()} {rowIx}</span>
										<span class="aria-hidden">
											<Trash2 />
										</span>
									</button>
								</div>
							</PopoverWrapper>
						</div>
					</InboundTable>
				</div>

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if entries?.length > maxResults}
					<div use:scroll.trigger></div>
				{/if}
			</div>
		{/if}
	</div>
</Page>

{#if $editDialogOpen}
	<div use:melt={$editDialogPortalled}>
		<div use:melt={$editDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}></div>
		<div
			use:melt={$editDialogContent}
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
					<h2 use:melt={$editDialogTitle} class="text-lg font-medium">{tCommon.edit_book_dialog.title()}</h2>
					<p use:melt={$editDialogDescription} class="leading-normal">
						{tCommon.edit_book_dialog.description()}
					</p>
				</div>
				<button use:melt={$editDialogClose} aria-label="Close" class="btn-neutral btn-outline btn-md btn">
					<X size={16} />
				</button>
			</div>
			<div class="px-6">
				<!-- {$connectivity} -->
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
					onCancel={() => editDialogOpen.set(false)}
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
{#if $confirmDialogOpen}
	{@const { type, onConfirm, title: dialogTitle, description: dialogDescription } = dialogContent}

	<div use:melt={$confirmDialogPortalled}>
		<div use:melt={$confirmDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
			<Dialog dialog={confirmActionDialog} {type} {onConfirm}>
				<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
				<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>
			</Dialog>
		</div>
	</div>
{/if}

<style>
	@media print {
		#inbound-header {
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
	}
</style>
