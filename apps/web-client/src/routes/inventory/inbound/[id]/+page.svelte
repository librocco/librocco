<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade, fly } from "svelte/transition";
	import { writable, readable } from "svelte/store";
	import { invalidate } from "$app/navigation";
	import { filter, scan } from "rxjs";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { Printer, QrCode, Trash2, FileEdit, MoreVertical, X, Loader2 as Loader, FileCheck } from "lucide-svelte";

	import { testId } from "@librocco/shared";
	import type { BookEntry } from "@librocco/db";

	import type { PageData } from "./$types";
	import type { InventoryTableData } from "$lib/components/Tables/types";

	import {
		Breadcrumbs,
		DropdownWrapper,
		PopoverWrapper,
		Page,
		PlaceholderBox,
		createBreadcrumbs,
		TextEditable,
		Dialog,
		InboundTable,
		ExtensionAvailabilityToast
	} from "$lib/components";
	import { BookForm, bookSchema, ScannerForm, scannerSchema, type BookFormSchema } from "$lib/forms";

	import { printBookLabel, printReceipt } from "$lib/printer";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";
	import { createExtensionAvailabilityStore } from "$lib/stores";
	import { autoPrintLabels, settingsStore } from "$lib/stores/app";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { mergeBookData } from "$lib/utils/misc";

	import {
		addVolumesToNote,
		commitNote,
		createOutboundNote,
		deleteNote,
		getNoteIdSeq,
		getReceiptForNote,
		removeNoteTxn,
		updateNote,
		updateNoteTxn
	} from "$lib/db/cr-sqlite/note";
	import { getBookData, upsertBook } from "$lib/db/cr-sqlite/books";
	import { appPath } from "$lib/paths";
	import { racefreeGoto } from "$lib/utils/navigation";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload when note
		const disposer1 = rx.onPoint("note", BigInt(data.id), () => invalidate("note:data"));
		// Reload when entries change
		const disposer2 = rx.onRange(["book", "book_transaction"], () => invalidate("note:books"));
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
	$: warehouseId = data.warehouseId;
	$: warehouseName = data.warehouseName;
	$: displayName = data.displayName;

	$: updatedAt = data.updatedAt;
	$: entries = data.entries;
	$: publisherList = data.publisherList;

	$: plugins = data.plugins;

	const handleCommitSelf = async (closeDialog: () => void) => {
		await commitNote(db, noteId);
		closeDialog();
	};

	const handleDeleteSelf = async (closeDialog: () => void) => {
		await deleteNote(db, noteId);
		closeDialog();
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

	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(plugins);

	// #region printing
	$: handlePrintReceipt = async () => {
		await printReceipt($settingsStore.receiptPrinterUrl, await getReceiptForNote(db, noteId));
	};
	$: handlePrintLabel = (book: BookEntry) => async () => {
		await printBookLabel($settingsStore.labelPrinterUrl, book);
	};
	// #endregion book-form

	$: breadcrumbs =
		noteId && warehouseId ? createBreadcrumbs("inbound", { id: warehouseId, displayName: warehouseName }, { id: noteId, displayName }) : [];

	const dialog = createDialog({
		forceVisible: true
	});
	const {
		elements: { trigger: dialogTrigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = dialog;

	let dialogContent: DialogContent & { type: "commit" | "delete" | "edit-row" };

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateOutboundNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);
		await goto(appPath("outbound", id));
	};
</script>

<Page {handleCreateOutboundNote} view="inbound-note" loaded={!loading}>
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

					if ($autoPrintLabels) {
						try {
							getBookData(db, isbn).then((b) => handlePrintLabel({ ...b, updatedAt: b.updatedAt.toISOString() })());
							// Success
						} catch (err) {
							// Show error
						}
					}
				}
			}}
		/>
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<div class="flex w-full flex-wrap items-center justify-between gap-2">
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
						<span class="badge badge-md badge-green">Last updated: {generateUpdatedAtString(updatedAt)}</span>
					{/if}
				</div>
			</div>

			<div class="ml-auto flex items-center gap-x-2">
				<button
					class="button button-green hidden xs:block"
					use:melt={$dialogTrigger}
					on:m-click={() => {
						dialogContent = {
							onConfirm: handleCommitSelf,
							title: dialogTitle.commitInbound(displayName),
							description: dialogDescription.commitInbound(entries.length, warehouseName),
							type: "commit"
						};
					}}
					on:m-keydown={() => {
						dialogContent = {
							onConfirm: handleCommitSelf,
							title: dialogTitle.commitInbound(displayName),
							description: dialogDescription.commitInbound(entries.length, warehouseName),
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
								title: dialogTitle.commitOutbound(displayName),
								description: dialogDescription.commitOutbound(entries.length),
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
						on:m-click={autoPrintLabels.toggle}
						class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-gray-100 {$autoPrintLabels
							? '!bg-green-400'
							: ''}"
					>
						<Printer class="text-gray-400" size={20} /><span class="text-gray-700">Auto print book labels</span>
					</div>
					<div
						{...item}
						use:item.action
						use:melt={$dialogTrigger}
						class="flex w-full items-center gap-2 bg-red-400 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-red-500"
						on:m-click={() => {
							dialogContent = {
								onConfirm: handleDeleteSelf,
								title: dialogTitle.delete(displayName),
								description: dialogDescription.deleteNote(),
								type: "delete"
							};
						}}
						on:m-keydown={() => {
							dialogContent = {
								onConfirm: handleDeleteSelf,
								title: dialogTitle.delete(displayName),
								description: dialogDescription.deleteNote(),
								type: "delete"
							};
						}}
					>
						<Trash2 class="text-white" size={20} /><span class="text-white">Delete</span>
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
			<PlaceholderBox title="Scan to add books" description="Plugin your barcode scanner and pull the trigger" class="center-absolute">
				<QrCode slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<InboundTable {table} on:edit-row-quantity={({ detail: { event, row } }) => updateRowQuantity(event, row)}>
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
									<span class="sr-only">Edit row {rowIx}</span>
									<span class="aria-hidden">
										<MoreVertical />
									</span>
								</button>

								<div slot="popover-content" data-testid={testId("popover-container")} class="rounded bg-gray-900">
									<button
										use:melt={$dialogTrigger}
										class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
										data-testid={testId("edit-row")}
										on:m-click={() => {
											const { warehouseId, quantity, ...bookData } = row;

											bookFormData = bookData;

											dialogContent = {
												onConfirm: () => {},
												title: dialogTitle.editBook(),
												description: dialogDescription.editBook(),
												type: "edit-row"
											};
										}}
										on:m-keydown={() => {
											const { warehouseId, quantity, ...bookData } = row;
											bookFormData = bookData;

											dialogContent = {
												onConfirm: () => {},
												title: dialogTitle.editBook(),
												description: dialogDescription.editBook(),
												type: "edit-row"
											};
										}}
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

									<button
										on:click={() => deleteRow(row.isbn, row.warehouseId)}
										class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
										data-testid={testId("delete-row")}
									>
										<span class="sr-only">Delete row {rowIx}</span>
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
					<div use:scroll.trigger />
				{/if}
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast {plugins} />
	</svelte:fragment>
</Page>

<div use:melt={$portalled}>
	{#if $open}
		{@const { type, onConfirm, title: dialogTitle, description: dialogDescription } = dialogContent}

		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }} />
		{#if type === "edit-row"}
			<div
				use:melt={$content}
				class="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 overflow-y-auto
				bg-white shadow-lg focus:outline-none"
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
		{:else}
			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} {type} {onConfirm}>
					<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
					<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>
				</Dialog>
			</div>
		{/if}
	{/if}
</div>
