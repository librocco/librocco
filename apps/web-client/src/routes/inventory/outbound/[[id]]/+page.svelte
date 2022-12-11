<script lang="ts">
	import { Delete, Search } from 'lucide-svelte';
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
		SelectMenu,
		TextEditable
	} from '@librocco/ui';

	import { NoteState, noteStates, NoteTempState } from '$lib/enums/noteStates';

	import {
		createNoteDisplayNameStore,
		createNoteStateStore,
		createTableContentStore,
		outNoteList
	} from '$lib/data/stores';

	$: currentNote = $page.params.id;

	const tableContent = createTableContentStore('outbound');

	$: displayName = createNoteDisplayNameStore(currentNote, 'outbound');
	$: state = createNoteStateStore(currentNote, 'outbound');
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
	</div>
</InventoryPage>
