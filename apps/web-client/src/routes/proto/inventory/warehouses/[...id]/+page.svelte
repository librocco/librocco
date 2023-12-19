<script lang="ts">
	import { fade, fly } from "svelte/transition";
	import { writable } from "svelte/store";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Search, FileEdit, X } from "lucide-svelte";

	import { NewStockTable, createTable, ProgressBar, Slideover, BookDetailForm } from "@librocco/ui";
	import type { BookEntry, SearchIndex } from "@librocco/db";
	import { debug } from "@librocco/shared";

	import { Page, PlaceholderBox, Breadcrumbs, createBreadcrumbs } from "$lib/components";

	import { goto } from "$app/navigation";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";
	import { noteToastMessages, toastSuccess, warehouseToastMessages } from "$lib/toasts";

	import { createWarehouseStores } from "$lib/stores/inventory";
	import { newBookFormStore } from "$lib/stores/book_form";

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

	$: warehouse = data.warehouse;

	// Create a search index for books in the db. Each time the books change, we recreate the index.
	// This is more/less inexpensive (around 2sec), considering it runs in the background.
	let index: SearchIndex | undefined;
	db?.books()
		.streamSearchIndex()
		.subscribe((ix) => (index = ix));

	const warehouseCtx = new debug.DebugCtxWithTimer(`[WAREHOUSE_ENTRIES::${warehouse?._id}]`, { debug: false, logTimes: false });
	$: warehouesStores = createWarehouseStores(warehouseCtx, warehouse, index);

	$: displayName = warehouesStores.displayName;
	$: entries = warehouesStores.entries;

	$: toasts = warehouseToastMessages(warehouse?.displayName);

	// #region warehouse-actions
	/**
	 * Handle create warehouse is an `no:click` handler used to create the new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateNote = async () => {
		loading = true;
		const note = await warehouse?.note().create();
		await goto(appPath("inbound", note._id));
		toastSuccess(noteToastMessages("Note").inNoteCreated);
	};
	// #endregion warehouse-actions

	// #region table
	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.set({ data: $entries });
	// #endregion table

	// #region book-form
	$: bookForm = newBookFormStore();

	const handleBookFormSubmit = async (book: BookEntry) => {
		await db.books().upsert([book]);
		toastSuccess(toasts.bookDataUpdated(book.isbn));
		bookForm.close();
	};
	// #endregion book-form

	$: breadcrumbs = createBreadcrumbs("warehouse", { id: warehouse?._id, displayName: warehouse?.displayName });

	const {
		elements: { trigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = createDialog({
		forceVisible: true
	});
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<h1 class="mb-2 text-2xl font-bold leading-7 text-gray-900">{$displayName}</h1>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if loading}
			<ProgressBar class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
		{:else if !$entries.length}
			<PlaceholderBox title="Add new inbound note" description="Get started by adding a new note" class="center-absolute">
				<button on:click={handleCreateNote} class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
					><span class="text-green-50">New note</span></button
				>
			</PlaceholderBox>
		{:else}
			<div class="[scrollbar-width: thin] h-full overflow-y-auto" style="scrollbar-width: thin">
				<NewStockTable {table}>
					<div slot="row-actions" let:row let:rowIx>
						<button
							use:melt={$trigger}
							on:m-click={async () => await bookForm.open(row)}
							class="rounded p-3 text-gray-500 hover:text-gray-900"
						>
							<span class="sr-only">Edit row {rowIx}</span>
							<span class="aria-hidden">
								<FileEdit />
							</span>
						</button>
					</div>
				</NewStockTable>
			</div>
		{/if}
	</svelte:fragment>
</Page>

<div use:melt={$portalled}>
	{#if $open}
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade={{ duration: 150 }}>
			<div
				use:melt={$content}
				class="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 bg-white
				shadow-lg focus:outline-none"
				transition:fly={{
					x: 350,
					duration: 300,
					opacity: 1
				}}
			>
				<div class="flex w-full flex-row justify-between bg-gray-50 px-6 py-4">
					<div>
						<h2 use:melt={$title} class="mb-0 text-lg font-medium text-black">Edit book details</h2>
						<p use:melt={$description} class="mb-5 mt-2 leading-normal text-zinc-600">Manually edit book details</p>
					</div>
					<button use:melt={$close} aria-label="Close" class="self-start rounded p-3 text-gray-500 hover:text-gray-900">
						<X class="square-4" />
					</button>
				</div>
				<div class="px-6">
					<BookDetailForm
						publisherList={$publisherList}
						book={$bookForm.open ? $bookForm.book : {}}
						on:submit={({ detail }) => handleBookFormSubmit(detail)}
						on:cancel={() => open.set(false)}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>
