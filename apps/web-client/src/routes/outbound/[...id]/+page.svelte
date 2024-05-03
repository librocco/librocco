<script lang="ts">
	import { map } from "rxjs";
	import { fade, fly } from "svelte/transition";
	import { writable } from "svelte/store";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Printer, QrCode, Trash2, FileEdit, MoreVertical, X, Loader2 as Loader, FileCheck, Power } from "lucide-svelte";

	import { goto } from "$app/navigation";

	import { NoteState, filter, testId, type VolumeStock } from "@librocco/shared";

	import {
		OutOfStockError,
		type BookEntry,
		type NavEntry,
		isCustomItemRow,
		type OutOfStockTransaction,
		NoWarehouseSelectedError,
		isBookRow
	} from "@librocco/db";

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
		type WarehouseChangeDetail,
		ExtensionAvailabilityToast
	} from "$lib/components";
	import type { InventoryTableData, OutboundTableData } from "$lib/components/Tables/types";
	import { BookForm, bookSchema, type BookFormOptions, ScannerForm, scannerSchema, customItemSchema } from "$lib/forms";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";
	import { createExtensionAvailabilityStore } from "$lib/stores";

	import { createNoteStores } from "$lib/stores/proto";
	import { scanAutofocus } from "$lib/stores/app";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";
	import type { CustomItemOptions } from "$lib/forms/CustomItemForm.svelte";
	import CustomItemForm from "$lib/forms/CustomItemForm.svelte";

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

	$: loading = !data;
	$: note = data.note;

	$: noteStores = createNoteStores(note);

	$: displayName = noteStores.displayName;
	$: defaultWarehouse = noteStores.defaultWarehouse;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: entries = noteStores.entries;

	// #region note-actions
	//
	// When the note is committed or deleted, automatically redirect to 'outbound' page.
	$: {
		if ($state === NoteState.Committed || $state === NoteState.Deleted) {
			goto(appPath("outbound"));
		}
	}

	const openNoWarehouseSelectedDialog = (invalidTransactions: VolumeStock<"book">[]) => {
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
	};

	const handleDeleteSelf = async () => {
		await note.delete({});
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
	const tableOptions = writable<{ data: OutboundTableData[] }>({
		data: $entries
			?.slice(0, maxResults)
			// TEMP: remove this when the db is updated
			.map((entry) => ({ __kind: "book", ...entry }))
	});

	const table = createTable(tableOptions);

	$: tableOptions.set({
		data: ($entries as OutboundTableData[])?.slice(0, maxResults)
	});
	// #endregion table

	// #region transaction-actions
	const handleAddTransaction = async (isbn: string) => {
		await note.addVolumes({ isbn, quantity: 1 });

		// First check if there exists a book entry in the db, if not, fetch book data using external sources
		//
		// Note: this is not terribly efficient, but it's the least ambiguous behaviour to implement
		const [localBookData] = await db.books().get([isbn]);
		if (localBookData) {
			return;
		}

		// If book data retrieved from 3rd party source - store it for future use
		const [thirdPartyBookData] = await db.plugin("book-fetcher").fetchBookData([isbn]);
		if (thirdPartyBookData) {
			await db.books().upsert([thirdPartyBookData]);
		}
	};

	const updateRowWarehouse = async (e: CustomEvent<WarehouseChangeDetail>, data: InventoryTableData) => {
		const { isbn, quantity, warehouseId: currentWarehouseId } = data;
		const { warehouseId: nextWarehouseId } = e.detail;
		// Number form control validation means this string->number conversion should yield a valid result
		const transaction = { isbn, warehouseId: currentWarehouseId, quantity };

		// Block identical updates (with respect to the existing state) as they might cause an feedback loop when connected to the live db.
		if (currentWarehouseId === nextWarehouseId) {
			return;
		}

		// TODO: error handling
		await note.updateTransaction({}, transaction, { ...transaction, warehouseId: nextWarehouseId });
	};

	const updateRowQuantity = async (e: SubmitEvent, { isbn, warehouseId, quantity: currentQty }: InventoryTableData) => {
		const data = new FormData(e.currentTarget as HTMLFormElement);
		// Number form control validation means this string->number conversion should yield a valid result
		const nextQty = Number(data.get("quantity"));

		const transaction = { isbn, warehouseId };

		if (currentQty == nextQty) {
			return;
		}

		await note.updateTransaction({}, transaction, { quantity: nextQty, ...transaction });
	};

	const handleAddCustomItem = () => note.addVolumes({ __kind: "custom", title: "Custom item", price: 10 });

	const deleteRow = async (rowIx: number) => {
		const row = $table.rows[rowIx];
		const match = isCustomItemRow(row) ? row.id : row;
		await note.removeTransactions(match);
	};
	// #region transaction-actions

	// #region book-form
	let bookFormData = null;
	let customItemFormData = null;

	/**
	 * A HOF takes in the row and decides on the appropriate handler to return (for appropriate form):
	 * - book form
	 * - custom item form
	 */
	const handleOpenFormPopover = (row: OutboundTableData & { key: string; rowIx: number }) => () =>
		isBookRow(row) ? openBookForm(row) : openCustomItemForm(row);

	const openBookForm = (row: OutboundTableData & { key: string; rowIx: number }) => {
		bookFormData = row;
		dialogContent = {
			onConfirm: () => {},
			title: dialogTitle.editBook(),
			description: dialogDescription.editBook(),
			type: "edit-row"
		};
	};
	const openCustomItemForm = (row: OutboundTableData & { key: string; rowIx: number }) => {
		customItemFormData = row;
		dialogContent = {
			onConfirm: () => {},
			title: dialogTitle.editCustomItem(),
			description: "",
			type: "custom-item-form"
		};
	};

	const onBookFormUpdated: BookFormOptions["onUpdated"] = async ({ form }) => {
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

			bookFormData = null;
			open.set(false);
		} catch (err) {
			// toastError(`Error: ${err.message}`);
		}
	};

	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(db);

	const onCustomItemUpdated: CustomItemOptions["onUpdated"] = async ({ form }) => {
		/**
		 * This is a quick fix for `form.data` having all optional properties
		 *
		 * Unforuntately, Zod will not infer the correct `data` type from our schema unless we configure `strictNullChecks: true` in our TS config.
		 * Doing so however raises a mountain of "... potentially undefined" type errors throughout the codebase. It will take a significant amount of work
		 * to fix these properly.
		 *
		 * It is still safe to assume that the required properties of BookEntry are there, as the relative form controls are required
		 */
		const data = form?.data as VolumeStock<"custom">;

		try {
			await note.updateTransaction({ name: "UPDATE_TXN", debug: true }, data.id, data);

			bookFormData = null;
			open.set(false);
		} catch (err) {
			console.error(err);
		}
	};
	// #endregion book-form

	$: breadcrumbs = note?._id ? createBreadcrumbs("outbound", { id: note._id, displayName: $displayName }) : [];

	// #region temp
	const handlePrint = async () => {
		db.printer()
			.receipt()
			.print(await note?.intoReceipt().then(({ items }) => items));
	};
	// #endregion temp

	const dialog = createDialog({
		forceVisible: true
	});
	const {
		elements: { trigger: dialogTrigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = dialog;

	let dialogContent:
		| ({ type: "commit" | "delete" | "edit-row" | "custom-item-form" } & DialogContent)
		| { type: "no-warehouse-selected"; invalidTransactions: VolumeStock<"book">[] }
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
		<button
			data-testid="scan-autofocus-toggle"
			data-is-on={$scanAutofocus}
			on:click={(e) => (scanAutofocus.toggle(), e.currentTarget.blur())}
			class="button {$scanAutofocus ? 'button-green' : 'button-white'} absolute right-4 top-1/2 -translate-y-1/2"
			><Power size={18} />Scan</button
		>
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
						<span class="badge badge-md badge-green">Last updated: {generateUpdatedAtString($updatedAt)}</span>
					{/if}
				</div>
			</div>

			<div class="ml-auto flex items-center gap-x-2">
				<div class="flex flex-col">
					<select
						id="defaultWarehouse"
						name="defaultWarehouse"
						class="flex w-full gap-x-2 rounded border-2 border-gray-500 bg-white p-2 shadow focus:border-teal-500 focus:outline-none focus:ring-0"
						bind:value={$defaultWarehouse}
					>
						{#each $warehouseList as warehouse}
							<option value={warehouse[0]}>{warehouse[1].displayName}</option>
						{/each}
					</select>
				</div>
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
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
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
										on:m-click={handleOpenFormPopover(row)}
										on:m-keydown={handleOpenFormPopover(row)}
									>
										<span class="sr-only">Edit row {rowIx}</span>
										<span class="aria-hidden">
											<FileEdit />
										</span>
									</button>

									{#if isBookRow(row)}
										<button
											class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
											data-testid={testId("print-book-label")}
											on:click={() => db.printer().label().print(row)}
										>
											<span class="sr-only">Print book label {rowIx}</span>
											<span class="aria-hidden">
												<Printer />
											</span>
										</button>
									{/if}

									<button
										on:click={() => deleteRow(rowIx)}
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
				</div>

				<div class="flex h-24 w-full items-center justify-end px-8">
					<button on:click={handleAddCustomItem} class="button button-green">Custom item</button>
				</div>

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if $entries?.length > maxResults}
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
							onUpdated: onBookFormUpdated
						}}
						onCancel={() => open.set(false)}
						onFetch={async (isbn, form) => {
							const result = await db.plugin("book-fetcher").fetchBookData([isbn]);

							const [bookData] = result;
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
						data={customItemFormData}
						options={{
							SPA: true,
							dataType: "json",
							validators: customItemSchema,
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
	{/if}
</div>
