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

	import { NoteState, noteStates, NoteTempState } from '$lib/enums/noteStates';

	import {
		createNoteDisplayNameStore,
		createNoteStateStore,
		createNoteUpdatedAtStore,
		createTableContentStores,
		inNoteList
	} from '$lib/data/stores';
	import { contentStoreLookup } from '$lib/data/backend_temp';

	import { generateUpdatedAtString } from '$lib/utils/time';

	$: currentNote = $page.params.id;
	$: currentNoteWarehouse =
		(currentNote &&
			Object.keys($inNoteList).find(
				(wName) => wName !== 'all' && $inNoteList[wName].find(({ id }) => currentNote === id)
			)) ||
		'';

	$: displayName = createNoteDisplayNameStore(currentNote, 'inbound');
	$: state = createNoteStateStore(currentNote, 'inbound');
	$: updatedAt = createNoteUpdatedAtStore(currentNote, 'inbound');

	$: contentStores = createTableContentStores(contentStoreLookup['inbound'], currentNote);

	$: entries = contentStores.entries;
	$: currentPage = contentStores.currentPage;
	$: paginationData = contentStores.paginationData;
</script>

<!-- svelte-ignore missing-declaration -->
<InventoryPage>
	<!-- Header slot -->
	<Header title="Inbound" currentLocation="/inventory/inbound" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each Object.entries($inNoteList) as [name, notes], index (name)}
			<SidebarItemGroup
				{name}
				{index}
				items={notes?.map(({ id, displayName }) => ({
					name: displayName || id,
					href: `/inventory/inbound/${id}`,
					current: name === $page.params.id
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
