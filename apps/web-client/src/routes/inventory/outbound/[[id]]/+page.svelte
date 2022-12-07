<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { page } from '$app/stores';

	import {
		InventoryPage,
		SidebarItem,
		TextField,
		Pagination,
		Badge,
		BadgeColor,
		InventoryTable,
		InventoryTableRow,
		Header,
		SelectMenu
	} from '@librocco/ui';

	import { createNoteStateStore, createTableContentStore, outNotes } from '$lib/data/stores';
	import { NoteState, noteStates } from '$lib/enums/noteStates';

	$: currentNote = $page.params.id;

	const tableContent = createTableContentStore('outbound');
	$: state = createNoteStateStore(currentNote, 'outbound');
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header title="Outbound" currentLocation="/inventory/outbound" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each $outNotes as name}
			<SidebarItem {name} href="/inventory/outbound/{name}" current={name === currentNote} />
		{/each}
	</nav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if currentNote}
			<div class="flex w-full items-end justify-between">
				<div>
					<h2 class="cursor-normal mb-4 select-none text-lg font-medium text-gray-900">
						<span class="align-middle">{currentNote}</span>
					</h2>
					<div class="flex items-center gap-1.5 whitespace-nowrap">
						<SelectMenu
							class="w-[138px]"
							options={noteStates}
							bind:value={$state}
							disabled={$state === NoteState.Committed}
						/>
						<Badge label="Last updated: 20:58" color={BadgeColor.Success} />
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
		{#if $tableContent?.entries?.length}
			<InventoryTable>
				{#each $tableContent.entries as data}
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
	</div>
</InventoryPage>
