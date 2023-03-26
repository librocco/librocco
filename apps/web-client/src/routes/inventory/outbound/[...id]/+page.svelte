<script lang="ts">
	import { Search } from "lucide-svelte";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { writable } from "svelte/store";

	import {
		InventoryPage,
		TextField,
		Pagination,
		Badge,
		BadgeColor,
		OutNoteTable,
		createTable,
		Header,
		SelectMenu,
		TextEditable,
		SideBarNav,
		SidebarItem,
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

	const outNoteListCtx = { name: "[OUT_NOTE_LIST]", debug: false };
	const outNoteList = readableFromStream(outNoteListCtx, db?.stream().outNoteList(outNoteListCtx), []);

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateNote = async () => {
		const note = db.warehouse().note();
		await note.create();
		goto(`/inventory/outbound/${note._id}`);
	};

	$: note = data.note;

	$: noteStores = createNoteStores(note);

	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;
	$: entries = noteStores.entries;

	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.update(({ data }) => ({ data: $entries }));
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header links={inventoryLinks} title="Outbound" currentLocation="/inventory/outbound" slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $outNoteList as { displayName, id }}
			<SidebarItem name={displayName || id} href="/inventory/outbound/{id}" current={id === $page.params.id} />
		{/each}
		<svelte:fragment slot="actions">
			<NewEntitySideNavButton label="Create note" on:click={handleCreateNote} />
		</svelte:fragment>
	</SideBarNav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if $state && $state !== NoteState.Deleted}
			<div class="flex w-full items-end justify-between">
				{#if $state}
					<div>
						<h2 class="mb-4 text-gray-900">
							<TextEditable bind:value={$displayName} disabled={$state === NoteState.Committed} />
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
				{/if}
				<TextField name="search" placeholder="Serach">
					<Search slot="startAdornment" class="h-5 w-5" />
				</TextField>
			</div>
		{/if}
	</svelte:fragment>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		<OutNoteTable {table} />
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
