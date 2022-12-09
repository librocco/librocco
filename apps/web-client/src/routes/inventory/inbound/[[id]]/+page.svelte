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
		SelectMenu
	} from '@librocco/ui';

	import { createNoteStateStore, createTableContentStore, inNotes } from '$lib/data/stores';
	import { NoteState, noteStates, NoteTempState } from '$lib/enums/noteStates';

	$: currentNote = $page.params.id;
	$: currentNoteWarehouse = !currentNote
		? ''
		: Object.entries($inNotes).find(([, notes]) => notes.includes(currentNote))![0];

	const tableContent = createTableContentStore('inbound');
	$: state = createNoteStateStore(currentNote, 'inbound');
</script>

<!-- svelte-ignore missing-declaration -->
<InventoryPage>
	<!-- Header slot -->
	<Header title="Inbound" currentLocation="/inventory/inbound" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each Object.entries($inNotes) as [name, notes]}
			<SidebarItemGroup
				{name}
				index={0}
				items={notes.map((name) => ({ name, href: `/inventory/inbound/${name}`, current: name === $page.params.id }))}
			/>
		{/each}
	</nav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if Boolean(currentNote)}
			<div class="flex w-full items-end justify-between">
				{#if $state}
					<div>
						<h2 class="cursor-normal mb-4 select-none text-lg font-medium text-gray-900">
							<span class="align-middle">{currentNote} </span>
							<span class="align-middle text-sm font-normal text-gray-500">in {currentNoteWarehouse}</span>
						</h2>
						<div class="flex items-center gap-1.5 whitespace-nowrap">
							<SelectMenu
								class="w-[138px]"
								options={noteStates}
								bind:value={$state}
								disabled={[...Object.values(NoteTempState), NoteState.Committed].includes($state)}
							/>
							<Badge label="Last updated: 20:58" color={BadgeColor.Success} />
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
