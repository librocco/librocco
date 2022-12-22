<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { page } from '$app/stores';

	import {
		InventoryPage,
		SidebarItemGroup,
		TextField,
		Pagination,
		Badge,
		BadgeColor,
		InventoryTable,
		InventoryTableRow,
		Header,
		SelectMenu,
		TextEditable
	} from '@librocco/ui';

	import { noteStates, NoteTempState } from '$lib/enums/inventory';
	import { NoteState } from '$lib/enums/db';

	import type { InNoteList } from '$lib/types/db';

	import { createNoteStores } from '$lib/stores/inventory';

	import { generateUpdatedAtString } from '$lib/utils/time';
	import { db } from '$lib/db';

	const getCurrentWarehouse = (inNoteList: InNoteList, noteId: string) => {
		const warehouse = inNoteList.find(
			({ id, notes }) =>
				// "all" is note the 'warehouse' we're looking for
				id !== 'all' && notes.find(({ id }) => id === noteId)
		);
		return warehouse?.id || '';
	};

	const inNoteList = db().stream().inNoteList;

	$: currentNote = $page.params.id;
	$: currentNoteWarehouse = currentNote && getCurrentWarehouse($inNoteList, currentNote);

	$: noteStores = createNoteStores(db(), currentNote, currentNoteWarehouse);

	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: entries = noteStores.entries;
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;
</script>

<!-- svelte-ignore missing-declaration -->
<InventoryPage>
	<!-- Header slot -->
	<Header title="Inbound" currentLocation="/inventory/inbound" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each $inNoteList as { id, displayName, notes }, index (id)}
			<SidebarItemGroup
				name={displayName || id}
				{index}
				items={notes?.map(({ id, displayName }) => ({
					name: displayName || id,
					href: `/inventory/inbound/${id}`,
					current: id === $page.params.id
				}))}
			/>
		{/each}
	</nav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if $state && $state !== NoteState.Deleted}
			<div class="flex w-full items-end justify-between">
				<div>
					<h2 class="cursor-normal mb-4 select-none text-lg font-medium text-gray-900">
						<TextEditable class="inline-block" bind:value={$displayName} />
						<span class="align-middle text-sm font-normal text-gray-500">in {currentNoteWarehouse}</span>
					</h2>
					<div class="flex items-center gap-1.5 whitespace-nowrap">
						<SelectMenu
							class="w-[138px]"
							options={noteStates}
							bind:value={$state}
							disabled={[...Object.values(NoteTempState), NoteState.Committed].includes($state)}
						/>
						{#if $updatedAt}
							<Badge label="Last updated: {generateUpdatedAtString($updatedAt)}" color={BadgeColor.Success} />
						{/if}
					</div>
				</div>
				<TextField name="search" placeholder="Serach">
					<Search slot="startAdornment" class="h-5 w-5" />
				</TextField>
			</div>
		{/if}
	</svelte:fragment>

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
