<script lang="ts">
	import { map } from "rxjs";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";

	import { writable } from "svelte/store";

	import { NoteState, NoteTempState } from "@librocco/shared";
	import {
		InventoryPage,
		Pagination,
		Badge,
		BadgeColor,
		OutNoteTable,
		createTable,
		Header,
		SelectMenu,
		TextEditable,
		SideBarNav,
		SidebarItem,
		NewEntitySideNavButton,
		type TransactionUpdateDetail,
		type RemoveTransactionsDetail,
		ProgressBar,
		Slideover,
		BookDetailForm,
		ScanInput
	} from "@librocco/ui";

	import type { BookEntry } from "@librocco/db";

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

	const outNoteListCtx = { name: "[OUT_NOTE_LIST]", debug: false };
	const outNoteList = readableFromStream(
		outNoteListCtx,
		db
			?.stream()
			.outNoteList(outNoteListCtx)
			/** @TODO we could probably wrap the Map to be ArrayLike (by having 'm.length' = 'm.size') */
			.pipe(map((m) => [...m])),
		[]
	);

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
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;
	$: entries = noteStores.entries;

	$: toasts = noteToastMessages(note?.displayName);

	// #region note-actions
	//
	// When the note is committed or deleted, automatically redirect to 'outbound' page.
	$: {
		if ($state === NoteState.Committed || $state === NoteState.Deleted) {
			goto(`${base}/inventory/outbound`);

			const message = $state === NoteState.Committed ? toasts.outNoteCommited : toasts.noteDeleted;

			toastSuccess(message);
		}
	}

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateNote = async () => {
		loading = true;
		const note = db.warehouse().note();
		await note.create();
		await goto(`${base}/inventory/outbound/${note._id}`);

		toastSuccess(toasts.outNoteCreated);
	};
	// #region note-actions

	// #region table
	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.set({ data: $entries });
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
</script>

<InventoryPage view="outbound">
	<!-- Header slot -->
	<Header {links} currentLocation={`${base}/inventory/outbound/`} slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $outNoteList as [id, { displayName }]}
			<SidebarItem name={displayName || id} href="{base}/inventory/outbound/{id}" current={comparePaths(id, $page.params.id)} />
		{/each}
		<svelte:fragment slot="actions">
			<NewEntitySideNavButton label="Create note" on:click={handleCreateNote} />
		</svelte:fragment>
	</SideBarNav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if !loading && note}
			<div class="mb-10 flex w-full items-end justify-between">
				<div>
					<h2 class="cursor-normal mb-2.5 select-none text-lg font-medium text-gray-900">
						<TextEditable class="inline-block" bind:value={$displayName} disabled={$state === NoteState.Committed} />
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
	</svelte:fragment>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if !loading}
			{#if Boolean($entries.length)}
				<OutNoteTable
					{table}
					onEdit={bookForm.open}
					on:transactionupdate={handleTransactionUpdate}
					on:removetransactions={handleRemoveTransactions}
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
				<BookDetailForm publisherList={$publisherList} book={$bookForm.book} on:submit={({ detail }) => handleBookFormSubmit(detail)} />
			</Slideover>
		{/if}
	</svelte:fragment>
</InventoryPage>
