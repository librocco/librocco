<script lang="ts">
	import { goto } from '$app/navigation';
	import { Search } from 'lucide-svelte';
	import { page } from '$app/stores';

	import {
		InventoryPage,
		SidebarItem,
		TextField,
		Pagination,
		InventoryTable,
		InventoryTableRow,
		Header,
		TextEditable
	} from '@librocco/ui';

	import { db } from '$lib/db';
	import { createWarehouseStores } from '$lib/stores/inventory';
	import { readableFromStream } from '$lib/utils/streams';
	import type { WarehouseInterface } from '@librocco/db';

	const warehouseList = readableFromStream(db.stream().warehouseList, []);

	$: currentWarehouseId = $page.params.id;

	let warehouse: WarehouseInterface | undefined = undefined;

	$: {
		// Each time the current warehouse changes, set the ready to false
		warehouse = undefined;
		// Check if the warehouse exists, if not redirect back to /inventory/stock/0-all (default warehouse)
		if (currentWarehouseId) {
			db.warehouse(currentWarehouseId)
				.get()
				.then((res) => {
					if (!res) return goto('/inventory/stock/0-all');
					warehouse = res;
				});
		}
	}

	$: warehouesStores = createWarehouseStores(warehouse);

	$: displayName = warehouesStores.displayName;
	$: entries = warehouesStores.entries;
	$: currentPage = warehouesStores.currentPage;
	$: paginationData = warehouesStores.paginationData;
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header title="Stock" currentLocation="/inventory/stock" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each $warehouseList as { displayName, id }}
			<SidebarItem href="/inventory/stock/{id}" name={displayName || id} current={id === currentWarehouseId} />
		{/each}
	</nav>

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
			<InventoryTable>
				{#each $entries as data}
					<InventoryTableRow {data} />
				{/each}
			</InventoryTable>
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
