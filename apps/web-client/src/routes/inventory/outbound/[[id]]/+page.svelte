<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import {
		InventoryPage,
		SidebarItem,
		TextField,
		Pagination,
		Badge,
		BadgeColor,
		// InventoryTable,
		// createTable,
		Header,
		SelectMenu,
		TextEditable
	} from '@librocco/ui';

	import { noteStates, NoteTempState } from '$lib/enums/inventory';
	import { NoteState } from '$lib/enums/db';

	import { createNoteStores } from '$lib/stores/inventory';

	import { db } from '$lib/db';

	import { generateUpdatedAtString } from '$lib/utils/time';

	const { outNoteList, findNote } = db().stream();

	$: currentNote = $page.params.id;

	// Navigate back to /inventory/outbound if the note doesn't exist (or is deleted)
	$: if (currentNote && (!$findNote(currentNote) || $findNote(currentNote)?.state === NoteState.Deleted)) {
		goto('/inventory/outbound');
	}
	$: noteStores = createNoteStores(db(), currentNote);

	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: entries = noteStores.entries;
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header title="Outbound" currentLocation="/inventory/outbound" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each $outNoteList as { displayName, id }}
			<SidebarItem name={displayName || id} href="/inventory/outbound/{id}" current={id === currentNote} />
		{/each}
	</nav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if $state && $state !== NoteState.Deleted}
			<div class="flex w-full items-end justify-between">
				{#if $state}
					<div>
						<h2 class="mb-4 text-gray-900">
							<TextEditable bind:value={$displayName} />
						</h2>
						<div class="flex items-center gap-1.5 whitespace-nowrap">
							<SelectMenu
								class="w-[138px]"
								options={noteStates}
								bind:value={$state}
								disabled={[...Object.values(NoteTempState), NoteState.Committed].includes($state)}
							/>
							{#if $updatedAt}
								<Badge
									label="Last updated: {generateUpdatedAtString($updatedAt)}"
									color={BadgeColor.Success}
								/>
							{/if}
						</div>
					</div>
				{/if}
				<TextField name="search" placeholder="Serach">
					<Search slot="startAdornment" class="h-5 w-5" />
				</TextField>
			</div>
		{/if}
	</svelte:fragment>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if $entries.length}
			<!-- <InventoryTable {table} /> -->
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
