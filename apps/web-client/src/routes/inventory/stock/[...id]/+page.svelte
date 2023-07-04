<script lang="ts">
	import { Search } from "lucide-svelte";
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
		BookDetailForm
	} from "@librocco/ui";
	import { NEW_WAREHOUSE } from "@librocco/db";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

	import { createWarehouseStores } from "$lib/stores/inventory";
	import { bookFormStore } from "$lib/stores/inventory/book_form";

	import { readableFromStream } from "$lib/utils/streams";
	import { addBookEntry, handleBookEntry, handleCloseBookForm, publisherList } from "$lib/utils/book_form";

	import { links } from "$lib/data";
	import { toastSuccess, warehouseToastMessages } from "$lib/toasts";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const warehouseListCtx = { name: "[WAREHOUSE_LIST]", debug: false };
	const warehouseList = readableFromStream(warehouseListCtx, db?.stream().warehouseList(warehouseListCtx), []);

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !data;

	$: warehouse = data.warehouse;

	$: warehouesStores = createWarehouseStores(warehouse);

	$: displayName = warehouesStores.displayName;
	$: currentPage = warehouesStores.currentPage;
	$: paginationData = warehouesStores.paginationData;
	$: entries = warehouesStores.entries;

	$: toasts = warehouseToastMessages(warehouse?.displayName);

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

	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.update(({ data }) => ({ data: $entries }));

	const openEditMode = () => bookFormStore.update((store) => ({ ...store, editMode: true }));

	const formHeader = {
		title: "Edit book details",
		description: "Use this form to manually edit details of an existing book in your inbound note"
	};
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header {links} currentLocation={`${base}/inventory/stock/`} slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $warehouseList as { displayName, id }}
			<SidebarItem href="{base}/inventory/stock/{id}" name={displayName || id} current={id === $page.params.id} />
		{/each}
		<svelte:fragment slot="actions">
			<NewEntitySideNavButton label="Create warehouse" on:click={handleCreateWarehouse} />
		</svelte:fragment>
	</SideBarNav>

	<!-- Table header slot -->
	<div class="flex w-full items-end justify-between" slot="tableHeader">
		{#if !loading && warehouse}
			<h2 class="mb-4 text-gray-900">
				<TextEditable bind:value={$displayName} />
			</h2>
			<TextField name="search" placeholder="Serach">
				<svelte:fragment slot="startAdornment">
					<Search class="h-5 w-5" />
				</svelte:fragment>
			</TextField>
		{/if}
	</div>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if !loading}
			{#if Boolean($entries.length)}
				<InventoryTable {table} onEdit={handleBookEntry(true)} />
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
		{#if $bookFormStore.modalOpen}
			<Slideover title={formHeader.title} description={formHeader.description} handleClose={handleCloseBookForm}>
				<BookDetailForm
					editMode={true}
					{openEditMode}
					book={$bookFormStore.book}
					{publisherList}
					onSubmit={addBookEntry(db)}
					onCancel={handleCloseBookForm}
				/>
			</Slideover>
		{/if}
	</svelte:fragment>
</InventoryPage>
