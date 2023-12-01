<script lang="ts">
	import { map } from "rxjs";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";

	import { writable } from "svelte/store";

	import {
		InventoryPage,
		TextField,
		Pagination,
		InventoryTable,
		createTable,
		Header,
		TextEditable,
		SidebarItem,
		SideBarNav,
		NewEntitySideNavButton,
		ProgressBar,
		Slideover,
		BookDetailForm,
		DiscountInput
	} from "@librocco/ui";
	import { NEW_WAREHOUSE, type BookEntry, versionId } from "@librocco/db";
	import { debug } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";
	import { toastSuccess, warehouseToastMessages } from "$lib/toasts";

	import { createWarehouseStores } from "$lib/stores/inventory";
	import { newBookFormStore } from "$lib/stores/book_form";

	import { readableFromStream } from "$lib/utils/streams";
	import { comparePaths } from "$lib/utils/misc";

	import { links } from "$lib/data";
	import { onMount } from "svelte";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const warehouseListCtx = { name: "[WAREHOUSE_LIST]", debug: false };
	const warehouseList = readableFromStream(
		warehouseListCtx,
		db
			?.stream()
			.warehouseMap(warehouseListCtx)
			/** @TODO we could probably wrap the Map to be ArrayLike (by having 'm.length' = 'm.size') */
			.pipe(map((m) => [...m])),
		[]
	);

	const publisherListCtx = { name: "[PUBLISHER_LIST::INBOUND]", debug: false };
	const publisherList = readableFromStream(publisherListCtx, db?.books().streamPublishers(publisherListCtx), []);

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !data;

	$: warehouse = data.warehouse;

	const warehouseCtx = new debug.DebugCtxWithTimer(`[WAREHOUSE_ENTRIES::${warehouse?._id}]`, { debug: false, logTimes: false });
	$: warehouesStores = createWarehouseStores(warehouseCtx, warehouse);

	// TEMP: Register some handlers to the window for experimental purposes
	onMount(() => {
		window["startLogging"] = () => {
			warehouseCtx.logTimes = true;
		};
		window["endLogging"] = () => {
			warehouseCtx.logTimes = true;
		};
		window["getSearchStats"] = () => {
			const report = warehouseCtx.getTimes((k) => k.startsWith("search"));
			const average = warehouseCtx.getAvgTimes((k) => k.startsWith("search"));
			return {
				sampleSize: Object.values(report).length,
				averageTime: average
			};
		};
		window["clearSearchStats"] = () => {
			warehouseCtx.clearStats();
		};
	});

	$: displayName = warehouesStores.displayName;
	$: warehouseDiscount = warehouesStores.warehouseDiscount;
	$: currentPage = warehouesStores.currentPage;
	$: search = warehouesStores.search;
	$: paginationData = warehouesStores.paginationData;
	$: entries = warehouesStores.entries;

	$: toasts = warehouseToastMessages(warehouse?.displayName);

	// #region warehouse-actions
	/**
	 * Handle create warehouse is an `no:click` handler used to create the new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateWarehouse = async () => {
		loading = true;
		const warehouse = getDB().warehouse(NEW_WAREHOUSE);
		await warehouse.create();
		await goto(`${base}/inventory/stock/${warehouse._id}`);

		toastSuccess(toasts.warehouseCreated);
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
</script>

<InventoryPage view="stock">
	<!-- Header slot -->
	<Header {links} currentLocation={`${base}/inventory/stock/`} slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $warehouseList as [id, { displayName }]}
			<SidebarItem
				href="{base}/inventory/stock/{id}"
				name={displayName || id}
				current={comparePaths(versionId(id), versionId($page.params.id))}
			/>
		{/each}
		<svelte:fragment slot="actions">
			<NewEntitySideNavButton label="Create warehouse" on:click={handleCreateWarehouse} />
		</svelte:fragment>
	</SideBarNav>

	<!-- Table header slot -->
	<div class="flex w-full items-end justify-between" slot="tableHeader">
		{#if !loading && warehouse}
			<div>
				<h2 class="cursor-normal mb-2.5 select-none text-lg font-medium text-gray-900">
					<h2 class="mb-4 text-gray-900">
						<TextEditable bind:value={$displayName} />
					</h2>

					<pre>Search: {$search}</pre>
				</h2>
				{#if warehouse && !warehouse._id.includes("0-all")}
					<DiscountInput name="warehouse-discount" label="Warehouse Discount:" bind:value={$warehouseDiscount} />
				{/if}
			</div>
			<input type="text" bind:value={$search} name="search" placeholder="Search" />
		{/if}
	</div>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if !loading}
			{#if Boolean($entries.length)}
				<InventoryTable {table} onEdit={bookForm.open} />
			{/if}
		{:else}
			<ProgressBar class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
		{/if}
	</svelte:fragment>

	<!-- Table footer slot -->
	<div class="flex h-full flex-col items-center justify-between gap-y-2 lg:flex-row" slot="tableFooter">
		{#if !loading && warehouse}
			{#if $paginationData.totalItems}
				<p class="cursor-normal select-none text-sm font-medium leading-5">
					Showing <strong>{$paginationData.firstItem}</strong> to <strong>{$paginationData.lastItem}</strong>
					of
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
