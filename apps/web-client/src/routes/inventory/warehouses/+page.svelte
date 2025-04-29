<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { Edit, Table2, Trash2, HousePlus, Layers, SquarePercent } from "lucide-svelte";

	import { entityListView, testId } from "@librocco/shared";

	import { racefreeGoto } from "$lib/utils/navigation";

	import * as stockCache from "$lib/db/cr-sqlite/stock_cache";

	import { DropdownWrapper, PlaceholderBox } from "$lib/components";

	import { appPath } from "$lib/paths";

	import WarehouseForm from "$lib/forms/WarehouseForm.svelte";
	import WarehouseDeleteForm from "$lib/forms/WarehouseDeleteForm.svelte";
	import { warehouseSchema, type WarehouseFormSchema } from "$lib/forms/schemas";
	import PlaceholderDots from "$lib/components/Placeholders/PlaceholderDots.svelte";
	import PageCenterDialog from "$lib/components/Melt/PageCenterDialog.svelte";
	import { InventoryManagementPage } from "$lib/controllers";
	import { defaultDialogConfig } from "$lib/components/Melt";

	import { createInboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import { deleteWarehouse, getWarehouseIdSeq, upsertWarehouse } from "$lib/db/cr-sqlite/warehouse";
	import LL from "@librocco/shared/i18n-svelte";

	import type { PageData } from "./$types";

	export let data: PageData;

	$: ({ warehouses, plugins } = data);
	$: db = data.dbCtx?.db;

	$: tCommon = $LL.common;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload when warehouse data changes
		disposer = rx.onRange(["warehouse"], () => invalidate("warehouse:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	$: ({ warehouseTotals } = stockCache);

	const handleDeleteWarehouse = (id: number) => async () => {
		await deleteWarehouse(db, id);
		deleteDialogOpen.set(false);
	};

	/**
	 * Handle create warehouse is an `on:click` handler used to create a new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateWarehouse = async () => {
		const id = await getWarehouseIdSeq(db);
		await upsertWarehouse(db, { id });

		// Unsubscribe from db changes to prevent invalidate and page load race
		disposer?.();
		await goto(appPath("warehouses", id));
	};

	/**
	 * Handle create note is an `on:click` handler used to create a new inbound note in the provided warehouse.
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateInboundNote = (warehouseId: number) => async () => {
		const id = await getNoteIdSeq(db);
		await createInboundNote(db, warehouseId, id);
		await goto(appPath("inbound", id));
	};

	const warehouseEditDialog = createDialog(defaultDialogConfig);
	const {
		elements: { trigger: editDialogTrigger },
		states: { open: editDialogOpen }
	} = warehouseEditDialog;

	const warehouseDeleteDialog = createDialog(defaultDialogConfig);
	const {
		elements: { trigger: deleteDialogTrigger },
		states: { open: deleteDialogOpen }
	} = warehouseDeleteDialog;

	let warehouseToEdit: WarehouseFormSchema | null = null;
	let warehouseToDelete: { id: number; displayName: string } = null;

	let initialized = false;
	$: initialized = Boolean(db);
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
		<ul class={testId("entity-list-container")} data-view={entityListView("warehouse-list")}>
			{#if !warehouses.length}
				<div class="flex grow justify-center">
					<div class="mx-auto max-w-xl translate-y-1/2">
						<!-- Start entity list placeholder -->
						<PlaceholderBox title="New warehouse" description="Get started by adding a new warehouse">
							<HousePlus slot="icon" />
							<button slot="actions" on:click={handleCreateWarehouse} class="btn-primary btn w-full">
								<span class="button-text">New warehouse</span>
							</button>
						</PlaceholderBox>
						<!-- End entity list placeholder -->
					</div>
				</div>
			{:else}
				<!-- Start entity list -->
				{#each warehouses as { id, displayName, discount }}
					{@const href = appPath("warehouses", id)}

					<div class="group entity-list-row">
						<div class="flex flex-col gap-y-2 self-start">
							<a {href} class="entity-list-text-lg text-base-content hover:underline focus:underline">{displayName}</a>

							<div class="flex flex-row gap-x-8 gap-y-2 max-xs:flex-col">
								<div class="entity-list-text-sm flex items-center gap-x-2 text-sm text-base-content">
									<Layers size={18} />

									<div>
										{#await $warehouseTotals}
											<PlaceholderDots />
										{:then warehouseTotals}
											<span class="">{warehouseTotals.get(id)}</span>
										{/await}
										books
									</div>
								</div>

								{#if discount}
									<div class="flex items-center gap-x-2 text-sm text-base-content">
										<SquarePercent size={18} />

										<span class="entity-list-text-sm">{discount}% discount</span>
									</div>
								{/if}
							</div>
						</div>

						<div class="entity-list-actions">
							<button on:click={handleCreateInboundNote(id)} class="btn-primary btn-sm btn">
								<span class="button-text"> New note </span>
							</button>

							<DropdownWrapper let:separator let:item>
								<div
									{...item}
									use:item.action
									use:melt={$editDialogTrigger}
									on:m-click={() => {
										warehouseToEdit = { name: displayName, discount, id };
									}}
									on:m-keydown={() => {
										warehouseToEdit = { name: displayName, discount, id };
									}}
									class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 text-base-content data-[highlighted]:bg-base-300"
								>
									<Edit aria-hidden size={18} />
									<span>Edit</span>
								</div>

								<div {...separator} use:separator.action class="h-[1px] bg-base-300"></div>

								<a
									{href}
									{...item}
									use:item.action
									class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 text-base-content data-[highlighted]:bg-base-300"
								>
									<Table2 aria-hidden size={18} />
									<span>View Stock</span>
								</a>

								<div
									{...item}
									use:item.action
									use:melt={$deleteDialogTrigger}
									on:m-click={() => {
										warehouseToDelete = { id, displayName };
									}}
									on:m-keydown={() => {
										warehouseToDelete = { id, displayName };
									}}
									class="flex w-full items-center gap-2 bg-red-400 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-error"
								>
									<Trash2 class="text-error-content" size={18} />
									<span class="text-error-content">Delete</span>
								</div>
							</DropdownWrapper>
						</div>
					</div>
				{/each}
				<!-- End entity list -->
			{/if}
		</ul>
		<!-- End entity list contaier -->
	{/if}
</InventoryManagementPage>

<PageCenterDialog
	dialog={warehouseEditDialog}
	title={tCommon.edit_warehouse_dialog.title()}
	description={tCommon.edit_warehouse_dialog.description()}
>
	<WarehouseForm
		data={defaults(warehouseToEdit, zod(warehouseSchema))}
		options={{
			SPA: true,
			dataType: "json",
			validators: zod(warehouseSchema),
			validationMethod: "submit-only",
			onUpdated: async ({ form }) => {
				const { id, name: displayName, discount } = form?.data;
				await upsertWarehouse(db, { id, displayName, discount });
				editDialogOpen.set(false);
			}
		}}
		onCancel={() => editDialogOpen.set(false)}
	/>
</PageCenterDialog>

<PageCenterDialog dialog={warehouseDeleteDialog} title="" description={tCommon.delete_database_dialog.description()}>
	<WarehouseDeleteForm
		{...warehouseToDelete}
		options={{
			SPA: true,
			dataType: "json",
			validationMethod: "submit-only",
			onSubmit: handleDeleteWarehouse(warehouseToDelete.id)
		}}
		onCancel={() => deleteDialogOpen.set(false)}
	/>
</PageCenterDialog>
