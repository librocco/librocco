<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade } from "svelte/transition";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Library, Loader2 as Loader, Trash } from "lucide-svelte";

	import { entityListView, testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import InventoryManagementPage from "$lib/components/InventoryManagementPage.svelte";
	import { PlaceholderBox, Dialog } from "$lib/components";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";
	import { racefreeGoto } from "$lib/utils/navigation";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { appPath } from "$lib/paths";
	import { deleteNote } from "$lib/db/cr-sqlite/note";
	import { getWarehouseIdSeq, upsertWarehouse } from "$lib/db/cr-sqlite/warehouse";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;
		// Warehouse (names), note (names/list) and book_transaction (note's totalBooks) all affect the list
		disposer = rx.onRange(["warehouse", "note", "book_transaction"], () => invalidate("inbound:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data.dbCtx?.db;

	$: notes = data.notes;

	let initialized = false;
	$: initialized = Boolean(db);

	const handleCreateWarehouse = async () => {
		const id = await getWarehouseIdSeq(db);
		await upsertWarehouse(db, { id });
		await goto(appPath("warehouses", id));
	};

	const handleDeleteNote = (id: number) => async (closeDialog: () => void) => {
		await deleteNote(db, id);
		closeDialog();
	};

	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger },
		states: { open }
	} = dialog;

	let dialogContent: DialogContent;
</script>

<InventoryManagementPage {handleCreateWarehouse}>
	{#if !initialized}
		<div class="center-absolute">
			<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
		</div>
	{:else}
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<ul class={testId("entity-list-container")} data-view={entityListView("inbound-list")} data-loaded={true}>
			{#if !notes.length}
				<!-- Start entity list placeholder -->
				<PlaceholderBox
					title="No open notes"
					description="Get started by adding a new note with the appropriate warehouse"
					class="center-absolute"
				>
					<a
						href={appPath("warehouses")}
						class="mx-auto inline-block items-center gap-2 rounded-md bg-teal-500 py-[9px] pl-[15px] pr-[17px]"
						><span class="text-green-50">Back to warehouses</span></a
					>
				</PlaceholderBox>
				<!-- End entity list placeholder -->
			{:else}
				<!-- Start entity list -->
				{#each notes as note}
					{@const noteName = note.displayName || `Note - ${note.id}`}
					{@const displayName = `${note.warehouseName} / ${noteName}`}
					{@const updatedAt = generateUpdatedAtString(note.updatedAt)}
					{@const totalBooks = note.totalBooks}
					{@const href = appPath("inbound", note.id)}

					<div class="group entity-list-row">
						<div class="flex flex-col gap-y-2">
							<a {href} class="entity-list-text-lg text-gray-900 hover:underline focus:underline">{displayName}</a>

							<div class="flex flex-col items-start gap-y-2">
								<div class="flex gap-x-0.5">
									<Library class="mr-1 text-gray-700" size={24} />
									<span class="entity-list-text-sm text-gray-500">{totalBooks} books</span>
								</div>
								{#if note.updatedAt}
									<span class="badge badge-md badge-green">
										Last updated: {updatedAt}
									</span>
								{/if}
							</div>
						</div>

						<div class="entity-list-actions">
							<a {href} class="button button-alert"><span class="button-text">Edit</span></a>
							<button
								use:melt={$trigger}
								class="button button-white"
								aria-label="Delete note: {note.displayName}"
								on:m-click={() => {
									dialogContent = {
										onConfirm: handleDeleteNote(note.id),
										title: dialogTitle.delete(note.displayName),
										description: dialogDescription.deleteNote()
									};
								}}
							>
								<span aria-hidden="true">
									<Trash size={20} />
								</span>
							</button>
						</div>
					</div>
				{/each}
				<!-- End entity list -->
			{/if}
		</ul>
		<!-- End entity list contaier -->
	{/if}

	<div use:melt={$portalled}>
		{#if $open}
			{@const { onConfirm, title, description } = dialogContent};

			<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }} />
			<div class="fixed left-[50%] top-[50%] z-50 flex max-w-2xl translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} type="delete" {onConfirm}>
					<svelte:fragment slot="title">{title}</svelte:fragment>
					<svelte:fragment slot="description">{description}</svelte:fragment>
				</Dialog>
			</div>
		{/if}
	</div>
</InventoryManagementPage>
