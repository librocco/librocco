<script lang="ts">
	import { onMount } from "svelte";
	import { Edit, QrCode } from "lucide-svelte";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { writable } from "svelte/store";

	import {
		InventoryPage,
		TextField,
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
		Button,
		ButtonSize,
		TextFieldSize,
		type TransactionUpdateDetail,
		type RemoveTransactionsDetail,
		ProgressBar,
		BookDetailForm,
		Slideover
	} from "@librocco/ui";
	import type { BookEntry, DatabaseInterface, NavMap } from "@librocco/db";

	import { noteStates, NoteTempState } from "$lib/enums/inventory";
	import { NoteState } from "$lib/enums/db";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

	import { createNoteStores } from "$lib/stores/inventory";
	import { bookFormStore } from "$lib/stores/inventory/book_form";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";
	import { addBookEntry, handleBookEntry, handleCloseBookForm, openEditMode, publisherList } from "$lib/utils/book_form";

	import { links } from "$lib/data";
	import { base } from "$app/paths";
	import { map } from "rxjs";

	import { toastSuccess, noteToastMessages } from "$lib/toasts";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const findBook = (db: DatabaseInterface) => (values: BookEntry) => db.books().get([values.isbn]);

	const inNoteListCtx = { name: "[IN_NOTE_LIST]", debug: false };
	const inNoteList = readableFromStream(
		inNoteListCtx,
		db
			?.stream()
			.inNoteList(inNoteListCtx)
			.pipe(map((m) => [...m])),
		[]
	);

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> th 	us, loading false).
	$: loading = !data;

	$: note = data.note;
	$: warehouse = data.warehouse;

	$: noteStores = createNoteStores(note);

	$: isbn = "";
	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: entries = noteStores.entries;
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;
	$: formHeader = $bookFormStore.editMode
		? { title: "Edit book details", description: "Use this form to manually edit details of an existing book in your inbound note" }
		: { title: "Create a new book", description: "Use this form to manually add a new book to your inbound note" };

	$: toasts = noteToastMessages(note?.displayName, warehouse?.displayName);

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
		console.log("Bump");
		const { matchTxn, updateTxn } = detail;
		const { isbn, warehouseId, quantity = matchTxn.quantity } = updateTxn;

		await note.updateTransaction(matchTxn, { isbn, warehouseId, quantity });

		// TODO: This doesn't seem to work / get called?
		toastSuccess(toasts.volumeUpdated(isbn));
	};

	const handleRemoveTransactions = async (e: CustomEvent<RemoveTransactionsDetail>) => {
		await toastSuccess(toasts.volumeRemoved(e.detail.length));
		note.removeTransactions(...e.detail);
	};

	const handleEditBookEntry = handleBookEntry(true);

	const mapNotesToNavItems = (notes: NavMap) =>
		[...notes].map(([id, { displayName }]) => ({
			name: displayName || id,
			href: `${base}/inventory/inbound/${id}`,
			current: id === $page.params.id
		}));

</script>

<!-- svelte-ignore missing-declaration -->
<InventoryPage>
	<!-- Header slot -->
	<Header {links} currentLocation={`${base}/inventory/inbound/`} slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $inNoteList as [id, { displayName, notes }], index (id)}
			<SidebarItemGroup name={displayName || id} {index} items={mapNotesToNavItems(notes)}>
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
						class="w-[138px]"
						options={noteStates}
						bind:value={$state}
						disabled={[...Object.values(NoteTempState), NoteState.Committed].includes($state)}
						align="right"
					/>
				</div>
				<TextField name="scan-input" placeholder="Scan to add books..." variant={TextFieldSize.LG} bind:value={isbn}>
					<svelte:fragment slot="startAdornment">
						<QrCode />
					</svelte:fragment>
					<div let:value slot="endAdornment" class="flex gap-x-2">
						<Button on:click={() => handleBookEntry()({ ...$bookFormStore.book, isbn })} size={ButtonSize.SM}>
							<svelte:fragment slot="startAdornment">
								<Edit size={16} />
							</svelte:fragment>
							Create
						</Button>
					</div>
				</TextField>
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
					onEdit={handleEditBookEntry}
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
