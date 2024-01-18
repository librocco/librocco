<script lang="ts">
	import { fade, fly } from "svelte/transition";
	import { writable } from "svelte/store";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Search, FileEdit, X, Loader2 as Loader } from "lucide-svelte";

	import { debug } from "@librocco/shared";
	import type { BookEntry } from "@librocco/db";
	import { bookDataPlugin } from "$lib/db/plugins";

	import { Page, PlaceholderBox, Breadcrumbs, createBreadcrumbs, StockTable, createTable } from "$lib/components";
	import { BookForm, bookSchema, type BookFormOptions } from "$lib/forms";

	import { goto } from "$app/navigation";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

	import { noteToastMessages, toastSuccess, warehouseToastMessages } from "$lib/toasts";

	import { createWarehouseStores } from "$lib/stores/proto";

	import { createIntersectionObserver } from "$lib/actions";

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

	$: warehouse = data.warehouse!;

	const warehouseCtx = new debug.DebugCtxWithTimer(`[WAREHOUSE_ENTRIES::${warehouse?._id}]`, { debug: false, logTimes: false });
	$: warehouesStores = createWarehouseStores(warehouseCtx, warehouse);

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
		const note = await warehouse.note().create();
		await goto(appPath("inbound", note._id));
		toastSuccess(noteToastMessages("Note").inNoteCreated);
	};
	// #endregion warehouse-actions

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
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else if !$entries.length}
			<PlaceholderBox title="Add new inbound note" description="Get started by adding a new note" class="center-absolute">
				<button on:click={handleCreateNote} class="button button-green mx-auto"><span class="button-text">New note</span></button>
			</PlaceholderBox>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<StockTable {table}>
					<div slot="row-actions" let:row let:rowIx>
						<button
							use:melt={$trigger}
							on:m-click={() => {
								console.log(row);
								bookFormData = row;
							}}
							class="rounded p-3 text-gray-500 hover:text-gray-900"
						>
							<span class="sr-only">Edit row {rowIx}</span>
							<span class="aria-hidden">
								<FileEdit />
							</span>
						</button>
					</div>
				</StockTable>

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
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade={{ duration: 150 }}>
			<div
				use:melt={$content}
				class="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 overflow-y-auto bg-white
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
							const result = await bookDataPlugin.fetchBookData(isbn);

							if (result) {
								const [bookData] = result;
								form.update((data) => ({ ...data, ...bookData }));
							}
							// TODO: handle loading and errors
						}}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>
