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
		Header,
		TextEditable
	} from '@librocco/ui';

	import { db } from '$lib/db';

	import { observableFromStore } from '$lib/utils/streams';
	import { combineLatest, from, BehaviorSubject, Observable } from 'rxjs';
	import { map, mergeMap, combineLatestWith } from 'rxjs/operators';

	const { warehouseStock: warehouseStock$, bookStock: bookStock$ } = db().stream();
	const { setName } = db().warehouse();

	// TODO: Next:: Write up notes on how you expect DB streams to conform close to Pouch methods

	// Organising code
	import { createPaginationStream, createEntriesStream } from '$lib/rx/factories';

	// Rx local values (which probably don't need to be referenced elsewhere?)
	const localDisplayName$ = new BehaviorSubject('');
	const localCurrentPage$ = new BehaviorSubject(0);

	// Rx WarhouseList
	const warehouseList$ = warehouseStock$.pipe(
		map((warehouses) => Object.entries(warehouses)),
		map((warehouses) => warehouses.map(([id, { displayName }]) => ({ id, displayName })))
	);

	// Rx DisplayName
	// - consumes from page.id, warehouseStock data, and local store (Behaviour Subject)
	// - and updates via local store, through setName promise
	const pageId$ = observableFromStore(page).pipe(map((page) => page?.params?.id));
	const warehouse$ = combineLatest([pageId$, warehouseStock$]).pipe(map(([id, warehouses]) => warehouses[id] || {}));
	const displayName$ = warehouse$.pipe(
		combineLatestWith(pageId$, localDisplayName$),
		map(([warehouse, id, localName]) => {
			const source = localName ? localName : warehouse?.displayName || id;
			return source; //.toUpperCase();
		})
	);

	const setDisplayName$ = localDisplayName$.pipe(
		mergeMap((name) => {
			const promise = setName(name);
			return from(promise);
		})
	);
	// auto subscribe() // unsubscribe()
	$setDisplayName$;

	// Rx Entries & PaginationData - using Rx "table_content" factories
	const warehouseEntries$ = warehouse$.pipe(map(({ entries }) => entries));

	const entries$ = createEntriesStream(warehouseEntries$, localCurrentPage$, bookStock$);
	const paginationData$ = createPaginationStream(warehouseEntries$, localCurrentPage$);
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header title="Stock" currentLocation="/inventory/stock" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each $warehouseList$ as { displayName, id }}
			<SidebarItem href="/inventory/stock/{id}" name={displayName || id} current={id === $pageId$} />
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
		{#if $entries$.length}
			<InventoryTable>
				{#each $entries$ as data}
					<InventoryTableRow {data} />
				{/each}
			</InventoryTable>
		{/if}
	</svelte:fragment>

	<!-- Table footer slot -->
	<div class="flex h-full items-center justify-between" slot="tableFooter">
		{#if $paginationData$.totalItems}
			<p class="cursor-normal select-none text-sm font-medium leading-5">
				Showing <strong>{$paginationData$.firstItem}</strong> to <strong>{$paginationData$.lastItem}</strong> of
				<strong>{$paginationData$.totalItems}</strong> results
			</p>
		{/if}
		{#if $paginationData$.numPages > 1}
			<Pagination maxItems={7} bind:value={$localCurrentPage$} numPages={$paginationData$.numPages} />
		{/if}
	</div>
</InventoryPage>
