<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { page } from '$app/stores';

	import {
		InventoryPage,
		SidebarItem,
		TextField,
		Pagination,
		InventoryTable,
		InventoryTableRow,
		Header
	} from '@librocco/ui';

	import { createTableContentStore, warehouseList } from '$lib/data/stores';

	$: currentWarehouse = $page.params.id;

	const tableContent = createTableContentStore('stock');
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header title="Stock" currentLocation="/inventory/stock" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each $warehouseList as name}
			<SidebarItem href="/inventory/stock/{name}" {name} current={name === currentWarehouse} />
		{/each}
	</nav>

	<!-- Table header slot -->
	<div class="flex w-full items-end justify-between" slot="tableHeader">
		<h1 class="cursor-normal select-none text-lg font-semibold text-gray-900">{currentWarehouse}</h1>
		<TextField name="search" placeholder="Serach">
			<svelte:fragment slot="startAdornment">
				<Search class="h-5 w-5" />
			</svelte:fragment>
		</TextField>
	</div>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if $tableContent.length}
			<InventoryTable>
				{#each $tableContent as data}
					<InventoryTableRow {data} />
				{/each}
			</InventoryTable>
		{/if}
	</svelte:fragment>

	<!-- Table footer slot -->
	<div class="flex h-full items-center justify-between" slot="tableFooter">
		<p class="cursor-normal select-none text-sm font-medium leading-5">
			Showing <strong>1</strong> to <strong>10</strong> of <strong>97</strong> results
		</p>
		<Pagination maxItems={7} value={0} numPages={10} />
		/>
	</div>
</InventoryPage>
