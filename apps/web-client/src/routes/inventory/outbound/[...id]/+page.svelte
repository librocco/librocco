<script lang="ts">
	import { onMount } from "svelte";
	import { Edit, QrCode } from "lucide-svelte";
	import { map } from "rxjs";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";

	import { writable } from "svelte/store";

	import {
		InventoryPage,
		TextField,
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
		TextFieldSize,
		ButtonSize,
		Button,
		type TransactionUpdateDetail,
		type RemoveTransactionsDetail,
		ProgressBar,
		Slideover,
		BookDetailForm
	} from "@librocco/ui";

	import type { BookEntry, DatabaseInterface } from "@librocco/db";

	import { noteStates, NoteTempState } from "$lib/enums/inventory";
	import { NoteState } from "$lib/enums/db";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

	import { createNoteStores } from "$lib/stores/inventory";
	import { bookFormStore } from "$lib/stores/inventory/book_form";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";
	import { addBookEntry, findBook, handleBookEntry, handleCloseBookForm, openEditMode, publisherList } from "$lib/utils/book_form";

	import { links } from "$lib/data";
	import { toastSuccess, noteToastMessages } from "$lib/toasts";

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

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !data;

	$: note = data.note;

	$: noteStores = createNoteStores(note);

	$: isbn = "";
	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;
	$: entries = noteStores.entries;

	$: toasts = noteToastMessages(note?.displayName);
	const formHeader = {
		title: "Edit book details",
		description: "Use this form to manually edit details of an existing book in your inbound note"
	};

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

	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.update(({ data }) => ({ data: $entries }));

	const handleAddTransaction = (db: DatabaseInterface) => async (bookEntry: BookEntry) => {
		isbn = "";
		addBookEntry(db)(bookEntry);
		await note.addVolumes({ isbn: bookEntry.isbn, quantity: $bookFormStore.editMode ? 0 : 1 });

		toastSuccess(toasts.volumeAdded(bookEntry.isbn));
	};

	const handleTransactionUpdate = async ({ detail }: CustomEvent<TransactionUpdateDetail>) => {
		const { matchTxn, updateTxn } = detail;
		const { isbn, warehouseId = "", quantity = matchTxn.quantity } = updateTxn;

		await note.updateTransaction(matchTxn, { isbn, warehouseId, quantity });

		// TODO: This doesn't seem to work / get called?
		toastSuccess(toasts.volumeUpdated(isbn));
	};

	const handleRemoveTransactions = async (e: CustomEvent<RemoveTransactionsDetail>) => {
		await note.removeTransactions(...e.detail);
		toastSuccess(toasts.volumeRemoved(e.detail.length));
	};
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header {links} currentLocation={`${base}/inventory/outbound/`} slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $outNoteList as [id, { displayName }]}
			<SidebarItem name={displayName || id} href="{base}/inventory/outbound/{id}" current={id === $page.params.id} />
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
					class="w-[138px]"
					options={noteStates}
					bind:value={$state}
					disabled={[...Object.values(NoteTempState), NoteState.Committed].includes($state)}
					align="right"
				/>
			</div>
			<TextField bind:value={isbn} name="scan-input" placeholder="Scan to add books..." variant={TextFieldSize.LG}>
				<svelte:fragment slot="startAdornment">
					<QrCode />
				</svelte:fragment>
				<div let:value slot="endAdornment" class="flex gap-x-2">
					<!-- @TODO: no validation is implemented here -->
					<Button on:click={() => handleBookEntry()({ ...$bookFormStore.book, isbn })} size={ButtonSize.SM}>
						<svelte:fragment slot="startAdornment">
							<Edit size={16} />
						</svelte:fragment>
						Create
					</Button>
				</div>
			</TextField>
		{/if}
	</svelte:fragment>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if !loading}
			{#if Boolean($entries.length)}
				<OutNoteTable
					{table}
					onEdit={handleBookEntry(true)}
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
		{#if $bookFormStore.modalOpen}
			<Slideover title={formHeader.title} description={formHeader.description} handleClose={handleCloseBookForm}>
				<BookDetailForm
					editMode={$bookFormStore.editMode}
					{openEditMode}
					book={$bookFormStore.book}
					{publisherList}
					onValidate={findBook(db)}
					onSubmit={handleAddTransaction(db)}
					onCancel={handleCloseBookForm}
				/>
			</Slideover>
		{/if}
	</svelte:fragment>
</InventoryPage>
