<script lang="ts">
	import { fade, fly } from "svelte/transition";
	import { writable } from "svelte/store";
	import { map } from "rxjs";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Printer, QrCode, Trash2, FileEdit, MoreVertical, X, Loader2 as Loader, FileCheck } from "lucide-svelte";

	import { goto } from "$app/navigation";

	import { NoteState, filter, testId, type VolumeStock } from "@librocco/shared";

	import { OutOfStockError, type BookEntry, type NavEntry, type OutOfStockTransaction, NoWarehouseSelectedError } from "@librocco/db";
	import { bookDataPlugin } from "$lib/db/plugins";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

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
		type WarehouseChangeDetail
	} from "$lib/components";
	import { BookForm, bookSchema, type BookFormOptions, ScannerForm, scannerSchema } from "$lib/forms";

	import { toastSuccess, noteToastMessages, toastError, bookFetchingMessages } from "$lib/toasts";
	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import { createNoteStores } from "$lib/stores/proto";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";
	import type { InventoryTableData, OutboundTableData } from "$lib/components/Tables/types";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const warehouseListCtx = { name: "[WAREHOUSE_LIST]", debug: false };
	const warehouseListStream = db
		?.stream()
		.warehouseMap(warehouseListCtx)
		.pipe(map((m) => new Map<string, NavEntry>(filter(m, ([warehouseId]) => !warehouseId.includes("0-all")))));
	const warehouseList = readableFromStream(warehouseListCtx, warehouseListStream, new Map<string, NavEntry>([]));

	const publisherListCtx = { name: "[PUBLISHER_LIST::INBOUND]", debug: false };
	const publisherList = readableFromStream(publisherListCtx, db?.books().streamPublishers(publisherListCtx), []);

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !data;

	$: note = data.note;

	$: noteStores = createNoteStores(note);

	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: entries = noteStores.entries;

	$: toasts = noteToastMessages(note?.displayName);

	// #region note-actions
	//
	// When the note is committed or deleted, automatically redirect to 'outbound' page.
	$: {
		if ($state === NoteState.Committed || $state === NoteState.Deleted) {
			goto(appPath("outbound"));

			const message = $state === NoteState.Committed ? toasts.outNoteCommited : toasts.noteDeleted;

			toastSuccess(message);
		}
	}

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
			await note.commit({});
			closeDialog();
			toastSuccess(noteToastMessages("Note").outNoteCommited);
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

	const handleReconcileAndCommitSelf = async (closeDialog: () => void) => {
		await note.reconcile({});
		await note.commit({});
		closeDialog();
		toastSuccess(noteToastMessages("Note").outNoteCommited);
	};

	const handleDeleteSelf = async () => {
		await note.delete({});
		toastSuccess(noteToastMessages("Note").noteDeleted);
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
	const tableOptions = writable({
		data: $entries?.slice(0, maxResults)
	});

	const table = createTable(tableOptions);

	$: tableOptions.set({ data: $entries?.slice(0, maxResults) });
	// #endregion table

	// #region transaction-actions
	const handleAddTransaction = async (isbn: string) => {
		await note.addVolumes({ isbn, quantity: 1 });
		toastSuccess(toasts.volumeAdded(isbn));
	};

	const updateRowWarehouse = async (
		e: CustomEvent<WarehouseChangeDetail>,
		{ isbn, quantity, warehouseId: currentWarehouseId }: OutboundTableData
	) => {
		const { warehouseId: nextWarehouseId } = e.detail;
		// Number form control validation means this string->number conversion should yield a valid result
		const transaction = { isbn, warehouseId: currentWarehouseId, quantity };

		// Block identical updates (with respect to the existing state) as they might cause an feedback loop when connected to the live db.
		if (currentWarehouseId === nextWarehouseId) {
			return;
		}

		// TODO: error handling
		await note.updateTransaction(transaction, { ...transaction, warehouseId: nextWarehouseId });
		toastSuccess(toasts.warehouseUpdated(isbn));
	};

	const updateRowQuantity = async (e: SubmitEvent, { isbn, warehouseId, quantity: currentQty }: InventoryTableData) => {
		const data = new FormData(e.currentTarget as HTMLFormElement);
		// Number form control validation means this string->number conversion should yield a valid result
		const nextQty = Number(data.get("quantity"));

		const transaction = { isbn, warehouseId };

		if (currentQty == nextQty) {
			return;
		}

		await note.updateTransaction(transaction, { quantity: nextQty, ...transaction });
		toastSuccess(toasts.volumeUpdated(isbn));
	};

	const deleteRow = async (isbn: string, warehouseId: string) => {
		await note.removeTransactions({ isbn, warehouseId });
		toastSuccess(toasts.volumeRemoved(1));
	};
	// #region transaction-actions

	// #region book-form
	let bookFormData = null;

	const onUpdated: BookFormOptions["onUpdated"] = async ({ form }) => {
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
			await db.books().upsert([data]);

			toastSuccess(toasts.bookDataUpdated(data.isbn));
			bookFormData = null;
			open.set(false);
		} catch (err) {
			// toastError(`Error: ${err.message}`);
		}
	};
	// #endregion book-form

	$: breadcrumbs = note?._id ? createBreadcrumbs("outbound", { id: note._id, displayName: $displayName }) : [];

	// #region temp
	const handlePrint = () => {};
	// #endregion temp

	const dialog = createDialog({
		forceVisible: true
	});
	const {
		elements: { trigger: dialogTrigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = dialog;

	let dialogContent:
		| ({ type: "commit" | "delete" | "edit-row" } & DialogContent)
		| { type: "no-warehouse-selected"; invalidTransactions: VolumeStock[] }
		| { type: "reconcile"; invalidTransactions: OutOfStockTransaction[] };
</script>

<Page view="outbound-note" loaded={!loading}>
	<svelte:fragment slot="topbar" let:iconProps>
		<QrCode {...iconProps} />
		<ScannerForm
			data={null}
			options={{
				SPA: true,
				dataType: "json",
				validators: scannerSchema,
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
					bind:value={$displayName}
				/>

				<div class="w-fit">
					{#if $updatedAt}
						<span class="badge badge-sm badge-green">Last updated: {generateUpdatedAtString($updatedAt)}</span>
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
							title: dialogTitle.commitOutbound(note.displayName),
							description: dialogDescription.commitOutbound($entries.length),
							type: "commit"
						};
					}}
					on:m-keydown={() => {
						dialogContent = {
							onConfirm: handleCommitSelf,
							title: dialogTitle.commitOutbound(note.displayName),
							description: dialogDescription.commitOutbound($entries.length),
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
								title: dialogTitle.commitOutbound(note.displayName),
								description: dialogDescription.commitOutbound($entries.length),
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
						on:m-click={handlePrint}
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
								title: dialogTitle.delete(note.displayName),
								description: dialogDescription.deleteNote(),
								type: "delete"
							};
						}}
						on:m-keydown={() => {
							dialogContent = {
								onConfirm: handleDeleteSelf,
								title: dialogTitle.delete(note.displayName),
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
		{:else if !$entries.length}
			<PlaceholderBox title="Scan to add books" description="Plugin your barcode scanner and pull the trigger" class="center-absolute">
				<QrCode slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="overflow-y-auto" style="scrollbar-width: thin">
				<OutboundTable
					{table}
					warehouseList={$warehouseList}
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
								<span class="sr-only">Edit row {rowIx}</span>
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
									on:m-click={() => {
										bookFormData = row;
										dialogContent = {
											onConfirm: () => {},
											title: dialogTitle.editBook(),
											description: dialogDescription.editBook(),
											type: "edit-row"
										};
									}}
									on:m-keydown={() => {
										bookFormData = row;
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
				</OutboundTable>

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if $entries?.length > maxResults}
					<div use:scroll.trigger />
				{/if}
			</div>
		{/if}
	</svelte:fragment>
</Page>

<div use:melt={$portalled}>
	{#if $open}
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }} />
		{#if dialogContent.type === "no-warehouse-selected"}
			<!-- No warehouse selecter dialog -->
			{@const { invalidTransactions } = dialogContent}

			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} type="delete" onConfirm={() => {}}>
					<svelte:fragment slot="title">{dialogTitle.noWarehouseSelected()}</svelte:fragment>
					<svelte:fragment slot="description">{dialogDescription.noWarehouseSelected()}</svelte:fragment>
					<h3 class="mt-4 mb-2 font-semibold">Please select a warehouse for each of the following transactions:</h3>
					<ul class="pl-2">
						{#each invalidTransactions as { isbn }}
							<li>{isbn}</li>
						{/each}
					</ul>
					<!-- A small hack to hide the 'Confirm' button as there's nothing to confirm -->
					<svelte:fragment slot="confirm-button"><span /></svelte:fragment>
				</Dialog>
			</div>
			<!-- No warehouse selecter dialog end -->
		{:else if dialogContent.type === "reconcile"}
			<!-- Note reconciliation dialog -->
			{@const { invalidTransactions } = dialogContent}

			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} type="delete" onConfirm={handleReconcileAndCommitSelf}>
					<svelte:fragment slot="title">{dialogTitle.reconcileOutbound()}</svelte:fragment>
					<svelte:fragment slot="description">{dialogDescription.reconcileOutbound()}</svelte:fragment>
					<h3 class="mt-4 mb-2 font-semibold">Please review the following tranasctions:</h3>
					<ul class="pl-2">
						{#each invalidTransactions as { isbn, warehouseName, quantity, available }}
							<li class="mb-2">
								<p><span class="font-semibold">{isbn}</span> in <span class="font-semibold">{warehouseName}:</span></p>
								<p class="pl-2">requested quantity: {quantity}</p>
								<p class="pl-2">available: {available}</p>
								<p class="pl-2">
									quantity for reconciliation: <span class="font-semibold">{quantity - available}</span>
								</p>
							</li>
						{/each}
					</ul>
				</Dialog>
			</div>
			<!-- Note reconciliation dialog end -->
		{:else}
			{@const { type, title: dialogTitle, description: dialogDescription } = dialogContent}

			{#if type === "edit-row"}
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
						<BookForm
							data={bookFormData}
							publisherList={$publisherList}
							options={{
								SPA: true,
								dataType: "json",
								validators: bookSchema,
								validationMethod: "submit-only",
								onUpdated
							}}
							onCancel={() => open.set(false)}
							onFetch={async (isbn, form) => {
								const result = await bookDataPlugin.fetchBookData([isbn]);
	
								if (!result) {
									toastError(bookFetchingMessages.bookNotFound);
								}
	
								const [bookData] = result;
								toastSuccess(bookFetchingMessages.bookFound);
								form.update((data) => ({ ...data, ...bookData }));
								// TODO: handle loading and errors
							}}
						/>
					</div>
				</div>
			{:else}
				<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
					<Dialog {dialog} {type} onConfirm={dialogContent.onConfirm}>
						<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
						<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>
					</Dialog>
				</div>
			{/if}
		{/if}
	{/if}
</div>
