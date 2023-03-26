<script lang="ts">
	import { Search } from "lucide-svelte";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
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
		NewEntitySideNavButton
	} from "@librocco/ui";
	import { NEW_WAREHOUSE } from "@librocco/db";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

	import { createWarehouseStores } from "$lib/stores/inventory";

	import { readableFromStream } from "$lib/utils/streams";

	import { inventoryLinks } from "$lib/data";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const warehouseListCtx = { name: "[WAREHOUSE_LIST]", debug: false };
	const warehouseList = readableFromStream(warehouseListCtx, db?.stream().warehouseList(warehouseListCtx), []);

	/**
	 * Handle create warehouse is an `no:click` handler used to create the new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateWarehouse = async () => {
		const warehouse = getDB().warehouse(NEW_WAREHOUSE);
		await warehouse.create();
		goto(`/inventory/stock/${warehouse._id}`);
	};

	$: warehouse = data.warehouse;

	$: warehouesStores = createWarehouseStores(warehouse);

	$: displayName = warehouesStores.displayName;
	$: currentPage = warehouesStores.currentPage;
	$: paginationData = warehouesStores.paginationData;
	$: entries = warehouesStores.entries;

	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.update(({ data }) => ({ data: $entries }));
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header links={inventoryLinks} title="Stock" currentLocation="/inventory/stock" slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $warehouseList as { displayName, id }}
			<SidebarItem href="/inventory/stock/{id}" name={displayName || id} current={id === $page.params.id} />
		{/each}
		<svelte:fragment slot="actions">
			<NewEntitySideNavButton label="Create warehouse" on:click={handleCreateWarehouse} />
		</svelte:fragment>
	</SideBarNav>

	<!-- Table header slot -->
	<div class="flex w-full items-end justify-between" slot="tableHeader">
		<h2 class="mb-4 text-gray-900">
			<TextEditable bind:value={$displayName} />
		</h2>
		<TextField name="search" placeholder="Serach">
			<svelte:fragment slot="startAdornment">
				<Search class="h-5 w-5" />
			</svelte:fragment>
		</TextField>
	</div>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if $entries.length}
			<InventoryTable {table} />
		{/if}
	</svelte:fragment>

	<!-- Table footer slot -->
	<div class="flex h-full items-center justify-between" slot="tableFooter">
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
	</div>
</InventoryPage>
