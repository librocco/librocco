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
	import { combineLatest, BehaviorSubject } from 'rxjs';
	import { map, tap } from 'rxjs/operators';

	import {
		createPaginationStream,
		createEntriesStream,
		createDisplayNameStream,
		createDbUpdateStream
	} from '$lib/rx/factories';

	const { warehouseStock: warehouseStock$, bookStock: bookStock$, warehouseList: warehouseList$ } = db().stream();

	// TODO: The slug is not updated.

	// Rx local values (which probably don't need to be referenced elsewhere?)
	const localDisplayName$ = new BehaviorSubject('');
	const localCurrentPage$ = new BehaviorSubject(0);

	const pageId$ = observableFromStore(page).pipe(
		map((page) => page?.params?.id),
		// Reset local values on change to page id
		// TODO: This means e.g that current page would be reset to 0 on each local navigation
		tap(() => localDisplayName$.next('')),
		tap(() => localCurrentPage$.next(0))
	);
	const warehouse$ = combineLatest([pageId$, warehouseStock$]).pipe(map(([id, warehouses]) => warehouses[id] || {}));

	let warehouseInterface = db().warehouse($pageId$);
	$: warehouseInterface;

	const displayName$ = createDisplayNameStream(warehouse$, localDisplayName$, pageId$);
	const setDisplayName$ = createDbUpdateStream(localDisplayName$, warehouseInterface.setName);

	// auto subscribe() // unsubscribe()
	$setDisplayName$;

	// Rx Entries & PaginationData - using Rx "table_content" factories
	const warehouseEntries$ = warehouse$.pipe(map(({ entries }) => entries));

	$: entries$ = createEntriesStream(warehouseEntries$, localCurrentPage$, bookStock$);
	$: paginationData$ = createPaginationStream(warehouseEntries$, localCurrentPage$);
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
			<Pagination
				maxItems={7}
				value={$localCurrentPage$}
				on:change={({ detail }) => localCurrentPage$.next(detail)}
				numPages={$paginationData$.numPages}
			/>
		{/if}
	</div>
</InventoryPage>
