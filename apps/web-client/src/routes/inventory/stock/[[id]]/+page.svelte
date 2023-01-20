<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { writable } from 'svelte/store';
	import { onDestroy } from 'svelte';

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

	import { createWarehouseStores } from '$lib/stores/inventory';
	import { db } from '$lib/db';

	import { observableFromStore } from '$lib/utils/streams';
	import { combineLatest, from, BehaviorSubject } from 'rxjs';
	import { map, mergeMap } from 'rxjs/operators';

	const { warehouseList: warehouseListStream, warehouseStock: warehouseStock$ } = db().stream();
	const { setName } = db().warehouse();

	// Rx DisplayName
	// - consumes from page.id, warehouseStock data, and local store (Behaviour Subject)
	// - and updates via local store, through setName promise
	const localDisplayName$ = new BehaviorSubject('');

	const page$ = observableFromStore(page).pipe(map((page) => page?.params?.id));
	const displayName$ = combineLatest([page$, warehouseStock$, localDisplayName$]).pipe(
		map(([id, warehouses, localName]) => {
			const source = localName ? localName : warehouses[id]?.displayName || id;
			return source; //.toUpperCase();
		})
	);
	const updateDisplayName$ = localDisplayName$
		.pipe(
			mergeMap((name) => {
				const promise = setName(name);
				return from(promise);
			})
		)
		.subscribe();

	onDestroy(() => updateDisplayName$.unsubscribe());

	$: currentWarehouse = $page.params.id;
	$: warehouesStores = createWarehouseStores(db(), currentWarehouse);

	// $: displayName = warehouesStores.displayName;
	$: entries = warehouesStores.entries;
	$: currentPage = warehouesStores.currentPage;
	$: paginationData = warehouesStores.paginationData;
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header title="Stock" currentLocation="/inventory/stock" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each $warehouseListStream as { displayName, id }}
			<SidebarItem href="/inventory/stock/{id}" name={displayName || id} current={id === currentWarehouse} />
		{/each}
	</nav>

	<!-- Table header slot -->
	<div class="flex w-full items-end justify-between" slot="tableHeader">
		<h2 class="mb-4 text-gray-900">
			<TextEditable value={$displayName$} onSave={(value) => localDisplayName$.next(value)} />
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
				Showing <strong>{$paginationData.firstItem}</strong> to <strong>{$paginationData.lastItem}</strong> of
				<strong>{$paginationData.totalItems}</strong> results
			</p>
		{/if}
		{#if $paginationData.numPages > 1}
			<Pagination maxItems={7} bind:value={$currentPage} numPages={$paginationData.numPages} />
		{/if}
	</div>
</InventoryPage>
