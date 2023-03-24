<script lang="ts">
	import { Search } from "lucide-svelte";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { writable } from 'svelte/store';

	import {
		InventoryPage,
		TextField,
		Pagination,
		Badge,
		BadgeColor,
		InventoryTable,
		createTable,
		Header,
		SelectMenu,
		TextEditable,
		SideBarNav,
		SidebarItemGroup,
		NewEntitySideNavButton
	} from "@librocco/ui";

	import { noteStates, NoteTempState } from "$lib/enums/inventory";
	import { NoteState } from "$lib/enums/db";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

	import { createNoteStores } from "$lib/stores/inventory";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";

	import { inventoryLinks } from "$lib/data";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const inNoteListCtx = { name: "[IN_NOTE_LIST]", debug: false };
	const inNoteList = readableFromStream(db?.stream().inNoteList(inNoteListCtx), [], inNoteListCtx);

	/**
	 * Handle create note returns an `on:click` handler enclosed with the id of the warehouse
	 * the new inbound note should be added to.
	 * _(The handler navigates to the newly created note page after the note has been created)_.
	 */
	const handleCreateNote = (warehousId: string) => async () => {
		const note = db.warehouse(warehousId).note();
		await note.create();
		goto(`/inventory/inbound/${note._id}`);
	};

	$: note = data.note;
	$: warehouse = data.warehouse;

	$: noteStores = createNoteStores(note);

	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: entries = noteStores.entries;
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;

	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.update(({ data }) => ({ data: $entries }));
</script>

<!-- svelte-ignore missing-declaration -->
<InventoryPage>
	<!-- Header slot -->
	<Header links={inventoryLinks} title="Inbound" currentLocation="/inventory/inbound" slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $inNoteList as { id, displayName, notes }, index (id)}
			<SidebarItemGroup
				name={displayName || id}
				{index}
				items={notes?.map(({ id, displayName }) => ({
					name: displayName || id,
					href: `/inventory/inbound/${id}`,
					current: id === $page.params.id
				}))}
			>
				<svelte:fragment slot="actions">
					<NewEntitySideNavButton label="Create note" on:click={handleCreateNote(id)} />
				</svelte:fragment>
			</SidebarItemGroup>
		{/each}
	</SideBarNav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if $state && $state !== NoteState.Deleted}
			<div class="flex w-full items-end justify-between">
				<div>
					<h2 class="cursor-normal mb-4 select-none text-lg font-medium text-gray-900">
						<TextEditable class="inline-block" bind:value={$displayName} disabled={$state === NoteState.Committed} />
						{#if warehouse}
							<span class="align-middle text-sm font-normal text-gray-500">in {warehouse.displayName}</span>
						{/if}
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
		<InventoryTable {table} />
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
