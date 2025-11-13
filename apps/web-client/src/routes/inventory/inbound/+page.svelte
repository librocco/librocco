<script lang="ts">
	import { onMount, onDestroy } from "svelte";
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

	import { appPath } from "$lib/paths";
	import { deleteNote } from "$lib/db/cr-sqlite/note";
	import { getWarehouseIdSeq, upsertWarehouse } from "$lib/db/cr-sqlite/warehouse";
	import { InventoryManagementPage } from "$lib/controllers";
	import LL from "@librocco/shared/i18n-svelte";
	import ConfirmDialog from "$lib/components/Dialogs/ConfirmDialog.svelte";

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

	let noteToDelete = null;
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

	const dialog = createDialog({ forceVisible: true, closeOnOutsideClick: false });
	const {
		elements: { trigger },
		states: { open }
	} = dialog;
	const resetDialogState = () => {
		open.set(false);
		noteToDelete = null;
	};
	const handleDeleteNote = async (id: number) => {
		await deleteNote(db, id);
	};
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
					{@const updatedAt = $LL.dateTime(note.updatedAt)}
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
										<time dateTime={new Date(note.updatedAt).toISOString()}>
											{updatedAt}
										</time>
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
									noteToDelete = note;
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

>
<ConfirmDialog
	{dialog}
	description={$LL.common.delete_dialog.title({ entity: noteToDelete?.displayName })}
	title={$LL.common.delete_dialog.description()}
	onConfirm={() => {
		handleDeleteNote(noteToDelete.id);
		resetDialogState();
	}}
	onCancel={resetDialogState}
	labels={{ confirm: "Confirm", cancel: "Cancel" }}
/>
