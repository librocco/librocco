<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade } from "svelte/transition";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { Library, Pencil, Trash } from "lucide-svelte";

	import { entityListView, testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { PlaceholderBox, Dialog } from "$lib/components";

	import { racefreeGoto } from "$lib/utils/navigation";

	import { appPath } from "$lib/paths";
	import { deleteWarehouse, getWarehouseIdSeq, upsertWarehouse } from "$lib/db/cr-sqlite/warehouse";
	import { InventoryManagementPage } from "$lib/controllers";
	import { WarehouseForm, warehouseSchema } from "$lib/forms";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	interface DialogContent {
		onConfirm: (closeDialog: () => void) => void;
		title: string;
		description: string;
	}

	$: ({ warehouses, plugins } = data);
	$: db = data.dbCtx?.db;

	$: tWarehouse = $LL.warehouse_list_page;
	$: tInventory = $LL.inventory_page.warehouses_tab;
	$: tCommon = $LL.common;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Warehouse (names), note (names/list) and book_transaction (note's totalBooks) all affect the list
		disposer = data.dbCtx?.rx?.onRange(["warehouse", "note", "book_transaction"], () => invalidate("warehouses:list"));
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

	const handleDeleteWarehouse = (id: number, displayName: string, bookCount: number) => async (closeDialog: () => void) => {
		await deleteWarehouse(db, id);
		closeDialog();
	};

	const handleViewWarehouse = (id: number) => async () => {
		await goto(appPath("warehouses", id));
	};

	const handleEditWarehouse = (id: number, displayName: string, discount: number) => async () => {
		editDialogData = { id, displayName, discount };
		editDialogOpen.set(true);
	};

	const confirmActionDialog = createDialog({
		forceVisible: true
	});
	const {
		elements: {
			trigger: confirmDialogTrigger,
			overlay: confirmDialogOverlay,
			portalled: confirmDialogPortalled
		},
		states: { open: confirmDialogOpen }
	} = confirmActionDialog;

	let dialogContent: DialogContent;

	const editWarehouseDialog = createDialog({
		forceVisible: true
	});
	const {
		elements: {
			overlay: editDialogOverlay,
			content: editDialogContent,
			portalled: editDialogPortalled
		},
		states: { open: editDialogOpen }
	} = editWarehouseDialog;

	let editDialogData = null;
</script>

<InventoryManagementPage title={tWarehouse.title()} view="warehouses" {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col divide-y">
		<div class="flex justify-between p-4">
			<h1 class="text-2xl font-bold">{tWarehouse.title()}</h1>
			<button class="btn-primary btn" on:click={handleCreateWarehouse}>{tInventory.labels.create_warehouse()}</button>
		</div>

		{#if !initialized}
			<div class="flex grow justify-center">
				<div class="mx-auto translate-y-1/2">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			</div>
		{:else if !warehouses?.length}
			<div class="flex grow justify-center">
				<div class="mx-auto max-w-xl translate-y-1/2">
					<!-- Start entity list placeholder -->
					<PlaceholderBox title={tWarehouse.placeholder.title()} description={tWarehouse.placeholder.description()}>
						<Library slot="icon" />
						<button slot="actions" on:click={handleCreateWarehouse} class="btn-primary btn w-full">
							{tInventory.labels.create_warehouse()}
						</button>
					</PlaceholderBox>
					<!-- End entity list placeholder -->
				</div>
			</div>
		{:else}
			<div class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
					{#each warehouses as { id, displayName, discount, bookCount }}
						<div class="card card-compact bg-base-100 shadow-xl">
							<div class="card-body">
								<h2 class="card-title">{displayName || `Warehouse ${id}`}</h2>
								<div class="flex flex-col gap-y-1">
									<p>{bookCount} {tWarehouse.stats.books()}</p>
									{#if discount}
										<p>{discount}% {tWarehouse.stats.discount()}</p>
									{/if}
								</div>
								<div class="card-actions justify-end">
									<button
										class="btn-outline btn-sm btn"
										data-testid={testId("edit-warehouse")}
										on:click={handleEditWarehouse(id, displayName, discount)}
									>
										<Pencil size={16} />
										<span>{tWarehouse.labels.edit()}</span>
									</button>
									<button
										class="btn-outline btn-error btn-sm btn"
										data-testid={testId("delete-warehouse")}
										use:melt={$confirmDialogTrigger}
										on:m-click={() => {
											dialogContent = {
												onConfirm: handleDeleteWarehouse(id, displayName, bookCount),
												title: tCommon.delete_dialog.title({ entity: displayName || `Warehouse ${id}` }),
												description: tCommon.delete_warehouse_dialog.description({ bookCount })
											};
										}}
										on:m-keydown={() => {
											dialogContent = {
												onConfirm: handleDeleteWarehouse(id, displayName, bookCount),
												title: tCommon.delete_dialog.title({ entity: displayName || `Warehouse ${id}` }),
												description: tCommon.delete_warehouse_dialog.description({ bookCount })
											};
										}}
									>
										<Trash size={16} />
										<span>{tWarehouse.labels.delete()}</span>
									</button>
									<button
										class="btn-primary btn-sm btn"
										data-testid={testId("view-warehouse")}
										on:click={handleViewWarehouse(id)}
									>
										<span>{tWarehouse.labels.view_stock()}</span>
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</InventoryManagementPage>

{#if $confirmDialogOpen}
	<div use:melt={$confirmDialogPortalled}>
		<div use:melt={$confirmDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
			<Dialog dialog={confirmActionDialog} onConfirm={dialogContent.onConfirm}>
				<svelte:fragment slot="title">{dialogContent.title}</svelte:fragment>
				<svelte:fragment slot="description">{dialogContent.description}</svelte:fragment>
			</Dialog>
		</div>
	</div>
{/if}

{#if $editDialogOpen}
	<div use:melt={$editDialogPortalled}>
		<div use:melt={$editDialogOverlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
			<div use:melt={$editDialogContent} class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-lg font-medium">{tCommon.edit_warehouse_dialog.title()}</h2>
				<p class="mb-6 text-sm text-gray-500">{tCommon.edit_warehouse_dialog.description()}</p>

				<WarehouseForm
					data={defaults(editDialogData, zod(warehouseSchema))}
					options={{
						SPA: true,
						dataType: "json",
						validators: zod(warehouseSchema),
						validationMethod: "submit-only",
						onUpdated: async ({ form }) => {
							const { id, displayName, discount } = form?.data;
							await upsertWarehouse(db, { id, displayName, discount });
							editDialogOpen.set(false);
						}
					}}
					onCancel={() => editDialogOpen.set(false)}
				/>
			</div>
		</div>
	</div>
{/if}
