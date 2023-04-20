<script lang="ts">
	import { Edit, QrCode } from "lucide-svelte";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";

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
		NewEntitySideNavButton,
		TextFieldSize,
		ButtonSize,
		Button,
		type TransactionUpdateDetail,
		type RemoveTransactionsDetail,
		ProgressBar
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
		loading = true;
		const note = db.warehouse().note();
		await note.create();
		goto(`${base}/inventory/outbound/${note._id}`);
	};

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !data;

	$: note = data.note;

	$: noteStores = createNoteStores(note);

	$: displayName = noteStores.displayName;
	$: state = noteStores.state;
	$: updatedAt = noteStores.updatedAt;
	$: currentPage = noteStores.currentPage;
	$: paginationData = noteStores.paginationData;
	$: entries = noteStores.entries;

	// When the note is committed or deleted, automatically redirect to 'outbound' page.
	$: {
		if ($state === NoteState.Committed || $state === NoteState.Deleted) {
			goto(`${base}/inventory/outbound`);
		}
	}

	const tableOptions = writable({
		data: $entries
	});

	const table = createTable(tableOptions);

	$: tableOptions.update(({ data }) => ({ data: $entries }));

	const handleAddTransaction = (isbn: string) => () => note.addVolumes({ isbn, quantity: 1 });

	const handleTransactionUpdate = ({ detail }: CustomEvent<TransactionUpdateDetail>) => {
		const { matchTxn, updateTxn } = detail;
		const { isbn, warehouseId = "", quantity = matchTxn.quantity } = updateTxn;

		return note.updateTransaction(matchTxn, { isbn, warehouseId, quantity });
	};

	const handleRemoveTransactions = (e: CustomEvent<RemoveTransactionsDetail>) => note.removeTransactions(...e.detail);
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header links={inventoryLinks} currentLocation="/inventory/outbound" slot="header" />

	<!-- Sidebar slot -->
	<SideBarNav slot="sidebar">
		{#each $outNoteList as { displayName, id }}
			<SidebarItem name={displayName || id} href="{base}/inventory/outbound/{id}" current={id === $page.params.id} />
		{/each}
		<svelte:fragment slot="actions">
			<NewEntitySideNavButton label="Create note" on:click={handleCreateNote} />
		</svelte:fragment>
	</SideBarNav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if !loading && note}
			<div class="mb-10 flex w-full items-end justify-between">
				<div>
					<h2 class="cursor-normal mb-2.5 select-none text-lg font-medium text-gray-900">
						<TextEditable class="inline-block" bind:value={$displayName} disabled={$state === NoteState.Committed} />
					</h2>
					{#if $updatedAt}
						<div>
							<Badge label="Last updated: {generateUpdatedAtString($updatedAt)}" color={BadgeColor.Success} />
						</div>
					{/if}
				</div>
				<SelectMenu
					class="w-[138px]"
					options={noteStates}
					bind:value={$state}
					disabled={[...Object.values(NoteTempState), NoteState.Committed].includes($state)}
					align="right"
				/>
			</div>
			<TextField name="scan-input" placeholder="Scan to add books..." variant={TextFieldSize.LG}>
				<svelte:fragment slot="startAdornment">
					<QrCode />
				</svelte:fragment>
				<div let:value slot="endAdornment" class="flex gap-x-2">
					<!-- @TODO: no validation is implemented here -->
					<Button on:click={handleAddTransaction(value)} size={ButtonSize.SM}>
						<svelte:fragment slot="startAdornment">
							<Edit size={16} />
						</svelte:fragment>
						Create
					</Button>
				</div>
			</TextField>
		{/if}
	</svelte:fragment>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if !loading}
			{#if note}
				<OutNoteTable {table} on:transactionupdate={handleTransactionUpdate} on:removetransactions={handleRemoveTransactions} />
			{/if}
		{:else}
			<ProgressBar class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
		{/if}
	</svelte:fragment>

	<!-- Table footer slot -->
	<div class="flex h-full flex-col items-center justify-between gap-y-2 lg:flex-row" slot="tableFooter">
		{#if !loading && note}
			{#if $paginationData.totalItems}
				<p class="cursor-normal select-none text-sm font-medium leading-5">
					Showing <strong>{$paginationData.firstItem}</strong> to <strong>{$paginationData.lastItem}</strong> of
					<strong>{$paginationData.totalItems}</strong> results
				</p>
			{/if}
			{#if $paginationData.numPages > 1}
				<Pagination maxItems={7} bind:value={$currentPage} numPages={$paginationData.numPages} />
			{/if}
		{/if}
	</div>
</InventoryPage>
