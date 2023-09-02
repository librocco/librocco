<script lang="ts">
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { writable } from "svelte/store";
	import { base } from "$app/paths";
	import { map } from "rxjs";

	import { NoteState, NoteTempState } from "@librocco/shared";
	import {
		InventoryPage,
		Pagination,
		Badge,
		BadgeColor,
		InventoryTable,
		createTable,
		Header,
		SelectMenu,
		TextEditable,
		SideBarNav,
		SidebarItemGroup,
		NewEntitySideNavButton,
		ScanInput,
		type TransactionUpdateDetail,
		type RemoveTransactionsDetail,
		ProgressBar,
		BookDetailForm,
		Slideover
	} from "@librocco/ui";
	import type { BookEntry, NavMap } from "@librocco/db";

	import { noteStates } from "$lib/enums/inventory";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";
	import { toastSuccess, noteToastMessages } from "$lib/toasts";

	import { createNoteStores } from "$lib/stores/inventory";
	import { newBookFormStore } from "$lib/stores/book_form";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";
	import { comparePaths } from "$lib/utils/misc";

	import { links } from "$lib/data";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const inNoteListCtx = { name: "[IN_NOTE_LIST]", debug: false };
	const inNoteList = readableFromStream(
		inNoteListCtx,
		db
			?.stream()
			.inNoteList(inNoteListCtx)
			.pipe(map((m) => [...m])),
		[]
	);

	const publisherListCtx = { name: "[PUBLISHER_LIST::INBOUND]", debug: false };
	const publisherList = readableFromStream(publisherListCtx, db?.books().streamPublishers(publisherListCtx), []);

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> th 	us, loading false).
	$: loading = !data;

	$: note = data.note;
	$: warehouse = data.warehouse;

	$: noteStores = createNoteStores(note);

	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: entries = noteStores.entries;
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;

	$: toasts = noteToastMessages(note?.displayName, warehouse?.displayName);

	// #region note-actions
	//
	// When the note is committed or deleted, automatically redirect to 'inbound' page.
	$: {
		if ($state === NoteState.Committed || $state === NoteState.Deleted) {
			goto(`${base}/inventory/inbound`);

			const message = $state === NoteState.Committed ? toasts.inNoteCommited : toasts.noteDeleted;

			toastSuccess(message);
		}
	}

	/**
	 * Handle create note returns an `on:click` handler enclosed with the id of the warehouse
	 * the new inbound note should be added to.
	 * _(The handler navigates to the newly created note page after the note has been created)_.
	 */
	const handleCreateNote = (warehousId: string) => async () => {
		loading = true;
		const note = db.warehouse(warehousId).note();
		await note.create();
		await goto(`${base}/inventory/inbound/${note._id}`);

		toastSuccess(toasts.inNoteCreated);
	};
	// #endregion note-actions

	// #region table
	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.update(() => ({ data: $entries }));
	// #endregion table

	// #region transaction-actions
	const handleAddTransaction = async (isbn: string) => {
		await note.addVolumes({ isbn, quantity: 1 });
		toastSuccess(toasts.volumeAdded(isbn));
		bookForm.close();
	};

	const handleTransactionUpdate = async ({ detail }: CustomEvent<TransactionUpdateDetail>) => {
		const { matchTxn, updateTxn } = detail;

		await note.updateTransaction(matchTxn, { quantity: matchTxn.quantity, warehouseId: "", ...updateTxn });

		// TODO: This doesn't seem to work / get called?
		toastSuccess(toasts.volumeUpdated(matchTxn.isbn));
	};

	const handleRemoveTransactions = async (e: CustomEvent<RemoveTransactionsDetail>) => {
		await note.removeTransactions(...e.detail);
		toastSuccess(toasts.volumeRemoved(e.detail.length));
	};
	// #region transaction-actions

	// #region book-form
	$: bookForm = newBookFormStore();

	const handleBookFormSubmit = async (book: BookEntry) => {
		await db.books().upsert([book]);
		toastSuccess(toasts.bookDataUpdated(book.isbn));
		bookForm.close();
	};
	// #endregion book-form

	// #region helpers
	const mapNotesToNavItems = (notes: NavMap, currentId: string) =>
		[...notes].map(([id, { displayName }]) => ({
			name: displayName || id,
			href: `${base}/inventory/inbound/${id}`,
			current: comparePaths(id, currentId)
		}));
	// #endregion helpers
</script>

<!-- svelte-ignore missing-declaration -->
<InventoryPage view="inbound">
	<!-- Header slot -->
	<Header {links} currentLocation={`${base}/inventory/inbound/`} slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $inNoteList as [id, { displayName, notes }], index (id)}
			<SidebarItemGroup
				name={displayName || id}
				expand={$page.params.id.includes(id)}
				{index}
				items={mapNotesToNavItems(notes, $page.params.id)}
			>
				<svelte:fragment slot="actions">
					{#if !id.includes("0-all")}
						<NewEntitySideNavButton label="Create note" on:click={handleCreateNote(id)} />
					{/if}
				</svelte:fragment>
			</SidebarItemGroup>
		{/each}
	</SideBarNav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if !loading && note}
			{#if $state && $state !== NoteState.Deleted}
				<div class="mb-10 flex w-full items-end justify-between">
					<div>
						<h2 class="cursor-normal mb-2.5 select-none text-lg font-medium text-gray-900">
							<TextEditable class="inline-block" bind:value={$displayName} disabled={$state === NoteState.Committed} />
							{#if warehouse}
								<span class="align-middle text-sm font-normal text-gray-500">in {warehouse.displayName}</span>
							{/if}
						</h2>
						{#if $updatedAt}
							<div>
								<Badge label="Last updated: {generateUpdatedAtString($updatedAt)}" color={BadgeColor.Success} />
							</div>
						{/if}
					</div>
					<SelectMenu
						id="note-state-picker"
						class="w-[138px]"
						options={noteStates}
						bind:value={$state}
						disabled={[...Object.values(NoteTempState), NoteState.Committed].includes($state)}
						align="right"
					/>
				</div>
				<ScanInput onAdd={handleAddTransaction} />
			{/if}
		{/if}
	</svelte:fragment>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if !loading}
			{#if Boolean($entries.length)}
				<InventoryTable
					{table}
					on:transactionupdate={handleTransactionUpdate}
					on:removetransactions={handleRemoveTransactions}
					onEdit={bookForm.open}
					interactive
				/>
			{/if}
		{:else}
			<ProgressBar class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
		{/if}
	</svelte:fragment>

	<!-- Table footer slot -->
	<div class="flex h-full flex-col items-center justify-between gap-y-2 lg:flex-row" slot="tableFooter">
		{#if !loading && note}
			{#if $paginationData.totalItems}
				<p class="cursor-normal select-none text-sm font-medium leading-5">
					Showing <strong>{$paginationData.firstItem}</strong> to <strong>{$paginationData.lastItem}</strong> of
					<strong>{$paginationData.totalItems}</strong> results
				</p>
			{/if}
			{#if $paginationData.numPages > 1}
				<Pagination maxItems={7} bind:value={$currentPage} numPages={$paginationData.numPages} />
			{/if}
		{/if}
	</div>

	<svelte:fragment slot="slideOver">
		{#if $bookForm.open}
			<Slideover {...$bookForm.slideoverText} handleClose={bookForm.close}>
				<BookDetailForm
					publisherList={$publisherList}
					book={$bookForm.book}
					on:submit={({ detail }) => handleBookFormSubmit(detail)}
					on:cancel={bookForm.close}
				/>
			</Slideover>
		{/if}
	</svelte:fragment>
</InventoryPage>
