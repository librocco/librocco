<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade } from "svelte/transition";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import ClockArrowUp from "$lucide/clock-arrow-up";
	import FilePlus from "$lucide/file-plus";
	import Layers from "$lucide/layers";
	import Library from "$lucide/library";
	import Trash from "$lucide/trash";

	import { entityListView, testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { PlaceholderBox, Dialog } from "$lib/components";

	import { racefreeGoto } from "$lib/utils/navigation";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { appPath } from "$lib/paths";
	import { deleteNote } from "$lib/db/cr-sqlite/note";
	import { getWarehouseIdSeq, upsertWarehouse } from "$lib/db/cr-sqlite/warehouse";
	import { InventoryManagementPage } from "$lib/controllers";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;
	interface DialogContent {
		onConfirm: (closeDialog: () => void) => void;
		title: string;
		description: string;
	}

	$: ({ notes, plugins } = data);
	$: db = data.dbCtx?.db;

	$: t = $LL.inventory_page.purchase_tab;
	$: tPurchase = $LL.purchase_note;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Warehouse (names), note (names/list) and book_transaction (note's totalBooks) all affect the list
		disposer = data.dbCtx?.rx?.onRange(["warehouse", "note", "book_transaction"], () => invalidate("inbound:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

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

<InventoryManagementPage {handleCreateWarehouse} {db} {plugins}>
	{#if !initialized}
		<div class="flex grow justify-center">
			<div class="mx-auto translate-y-1/2">
				<span class="loading loading-spinner loading-lg text-primary"></span>
			</div>
		</div>
	{:else}
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<ul class={testId("entity-list-container")} data-view={entityListView("inbound-list")}>
			{#if !notes.length}
				<!-- Start entity list placeholder -->

				<div class="flex grow justify-center">
					<div class="mx-auto max-w-xl translate-y-1/2">
						<!-- Start entity list placeholder -->
						<PlaceholderBox title={`${t.placeholder_box.title()}`} description={`${t.placeholder_box.description()}`}>
							<FilePlus slot="icon" />

							<a slot="actions" href={appPath("warehouses")} class="btn-primary btn w-full">
								<span class="text-green-50">
									{t.stats.back_to_warehouses()}
								</span>
							</a>
						</PlaceholderBox>
						<!-- End entity list placeholder -->
					</div>
				</div>

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
							<a {href} class="entity-list-text-lg text-base-content hover:underline focus:underline">{displayName}</a>

							<div class="flex flex-row gap-x-8 gap-y-2 max-sm:flex-col">
								<div class="flex gap-x-2">
									<Layers size={18} />
									<span class="entity-list-text-sm text-sm text-base-content"> {t.stats.books({ no_of_books: totalBooks })}</span>
								</div>
								{#if note.updatedAt}
									<div class="flex items-center gap-x-2 text-sm text-base-content">
										<ClockArrowUp size={18} />
										{t.stats.last_updated()}:
										{updatedAt}
									</div>
								{/if}
							</div>
						</div>

						<div class="entity-list-actions">
							<a {href} class="btn-secondary btn-outline btn-sm btn">{tPurchase.labels.edit()}</a>
							<button
								use:melt={$trigger}
								class="btn-secondary btn-sm btn"
								aria-label="Delete note: {note.displayName}"
								on:m-click={() => {
									dialogContent = {
										onConfirm: handleDeleteNote(note.id),
										title: $LL.common.delete_dialog.title({ entity: note.displayName }),
										description: $LL.common.delete_dialog.description()
									};
								}}
							>
								<Trash size={18} aria-hidden />
							</button>
						</div>
					</div>
				{/each}
				<!-- End entity list -->
			{/if}
		</ul>
		<!-- End entity list contaier -->
	{/if}
</InventoryManagementPage>

{#if $open}
	{@const { onConfirm, title, description } = dialogContent};

	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}></div>
		<div class="fixed left-[50%] top-[50%] z-50 flex max-w-2xl translate-x-[-50%] translate-y-[-50%]">
			<Dialog {dialog} type="delete" {onConfirm}>
				<svelte:fragment slot="title">{title}</svelte:fragment>
				<svelte:fragment slot="description">{description}</svelte:fragment>
			</Dialog>
		</div>
	</div>
{/if}
