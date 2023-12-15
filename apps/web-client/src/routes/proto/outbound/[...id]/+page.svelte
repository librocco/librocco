<script lang="ts">
	import { Printer, QrCode, Trash2 } from "lucide-svelte";
	import { map } from "rxjs";
	import { writable } from "svelte/store";

	import { goto } from "$app/navigation";

	import { NoteState } from "@librocco/shared";
	import {
		Badge,
		BadgeColor,
		OutNoteTable,
		createTable,
		type TransactionUpdateDetail,
		type RemoveTransactionsDetail,
		ProgressBar
	} from "@librocco/ui";
	import type { BookEntry } from "@librocco/db";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

	import { Breadcrumbs, DropdownWrapper, Page, PlaceholderBox, createBreadcrumbs } from "$lib/components";

	import { toastSuccess, noteToastMessages } from "$lib/toasts";

	import { createNoteStores } from "$lib/stores/proto";
	import { newBookFormStore } from "$lib/stores/book_form";

	import { scan } from "$lib/actions/scan";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

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

	const handleCommitSelf = async () => {
		await note.commit({});
		toastSuccess(noteToastMessages("Note").inNoteCommited);
	};

	const handleDeleteSelf = async () => {
		await note.delete({});
		toastSuccess(noteToastMessages("Note").noteDeleted);
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

	$: breadcrumbs = note?._id ? createBreadcrumbs("outbound", { id: note._id, displayName: $displayName }) : [];

	// #region temp
	const handlePrint = () => {};
	// #endregion temp
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<QrCode {...iconProps} />
		<input use:scan={handleAddTransaction} placeholder="Scan to add books" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<div class="flex w-full items-center justify-between">
			<div>
				<h1 class="mb-2 text-2xl font-bold leading-7 text-gray-900">{$displayName}</h1>

				<div class="h-5">
					{#if $updatedAt}
						<Badge label="Last updated: {generateUpdatedAtString($updatedAt)}" color={BadgeColor.Success} />
					{/if}
				</div>
			</div>

			<div class="flex items-center gap-x-3">
				<button on:click={handleCommitSelf} class="rounded-md bg-teal-500 px-[17px] py-[9px] text-green-50 active:bg-teal-400">
					<span class="text-sm font-medium leading-5 text-green-50">Commit</span>
				</button>

				<DropdownWrapper let:item>
					<div
						{...item}
						use:item.action
						on:m-click={handlePrint}
						class="data-[highlighted]:bg-gray-100 flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5"
					>
						<Printer class="text-gray-400" size={20} /><span class="text-gray-700">Print</span>
					</div>
					<div
						{...item}
						use:item.action
						on:m-click={handleDeleteSelf}
						class="data-[highlighted]:bg-red-500 flex w-full items-center gap-2 bg-red-400 px-4 py-3 text-sm font-normal leading-5"
					>
						<Trash2 class="text-white" size={20} /><span class="text-white">Delete</span>
					</div>
				</DropdownWrapper>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if loading}
			<ProgressBar class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
		{:else if !$entries.length}
			<PlaceholderBox title="Scan to add books" description="Plugin your barcode scanner and pull the trigger" class="center-absolute">
				<QrCode slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
		{:else}
			<OutNoteTable
				{table}
				onEdit={bookForm.open}
				on:transactionupdate={handleTransactionUpdate}
				on:removetransactions={handleRemoveTransactions}
			/>
		{/if}
	</svelte:fragment>
</Page>
