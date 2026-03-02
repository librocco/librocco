<script lang="ts">
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";

	import { stripNulls } from "@librocco/shared";
	import LL from "@librocco/shared/i18n-svelte";

	import type { PageData } from "./$types";
	import type { Supplier } from "$lib/db/cr-sqlite/types";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import { Page } from "$lib/controllers";

	import { supplierSchema, supplierDeleteSchema } from "$lib/forms/schemas";
	import { upsertSupplier, deleteSupplier } from "$lib/db/cr-sqlite/suppliers";
	import SupplierDeleteForm from "$lib/forms/SupplierDeleteForm.svelte";
	import { appPath } from "$lib/paths";
	import SupplierMetaForm from "$lib/forms/SupplierMetaForm.svelte";
	import { orderFormats } from "$lib/enums/orders";

	import { getDb, getDbRx } from "$lib/app/db";

	import { SupplierCard } from "$lib/components-new/SupplierCard";
	import { createLayoutDataStore } from "./dataLoad";
	import { goto } from "$lib/utils/navigation";

	import SupplierOrdersView from "./SupplierOrdersView.svelte";
	import SupplierPublishersView from "./SupplierPublishersView.svelte";

	type Props = {
		data: PageData;
	};

	let { data }: Props = $props();

	const app = data.app;
	const plugins = data.plugins;

	const supplierId = data.supplierId;
	const layoutData = data.layoutData;
	const ordersViewData = data.ordersViewData;
	const publishersViewData = data.publishersViewData;

	const rx = getDbRx(app);
	const layoutStore = createLayoutDataStore(rx, () => getDb(app), supplierId, layoutData ?? undefined);

	const supplier = $derived($layoutStore.data.supplier);

	const t = $derived($LL.order_list_page);
	const tSuppliers = $derived($LL.suppliers_page);

	const canDelete = $derived(!supplier?.hasActiveOrders);

	const dialog = createDialog(defaultDialogConfig);
	const {
		states: { open: dialogOpen }
	} = dialog;

	const deleteDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: deleteDialogOpen }
	} = deleteDialog;

	let activeTab = $state<"orders" | "publishers">("orders");

	const handleUpdateSupplier = async (_data: Partial<Supplier> & { underdeliveryPolicy?: string }) => {
		if (!supplier) return;

		const db = await getDb(app);
		const data = { ...stripNulls(supplier), ..._data };
		const underdelivery_policy = _data.underdeliveryPolicy ? (_data.underdeliveryPolicy === "queue" ? 1 : 0) : undefined;

		await upsertSupplier(db, { ...data, underdelivery_policy });
		dialogOpen.set(false);
	};

	const handleDeleteSupplier = async () => {
		if (!supplier?.id) return;

		const db = await getDb(app);
		await deleteSupplier(db, supplier.id);
		deleteDialogOpen.set(false);
		goto(appPath("suppliers"));
	};
</script>

<Page title={t.details.supplier_page()} view="orders/suppliers/id" {app} {plugins}>
	<div slot="main" class="h-full w-full">
		<div class="flex h-full flex-col gap-y-10 md:flex-row md:divide-x">
			<div class="min-w-fit md:basis-96 md:overflow-y-auto">
				<div class="card h-full">
					<div class="card-body p-0">
						<div class="col-span-3 overflow-auto border-[#E5E5E5] p-[20px] py-6 px-[20px]">
							{#if supplier}
								<SupplierCard
									name={supplier.name}
									id={supplier.id}
									email={supplier.email || "N/A"}
									address={supplier.address || "N/A"}
									orderFormat={supplier.orderFormat || "N/A"}
									underdeliveryPolicy={supplier.underdelivery_policy ?? 0}
									deleteDisabled={!canDelete}
									deleteDisabledReason={tSuppliers.errors.active_orders()}
									onedit={() => dialogOpen.set(true)}
									ondelete={() => deleteDialogOpen.set(true)}
								/>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="flex min-h-0 w-full flex-1 flex-col gap-y-2 overflow-y-auto">
				<div class="z-20 bg-white px-5 pt-6 pb-6">
					<nav class="flex gap-2">
						<button
							class="rounded font-normal transition-colors {activeTab === 'orders'
								? 'border border-gray-900 bg-gray-900 text-white'
								: 'border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-50'} px-4 py-2 text-[14px]"
							onclick={() => (activeTab = "orders")}
						>
							{t.tabs.orders()}
						</button>
						<button
							class="rounded font-normal transition-colors {activeTab === 'publishers'
								? 'border border-gray-900 bg-gray-900 text-white'
								: 'border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-50'} px-4 py-2 text-[14px]"
							onclick={() => (activeTab = "publishers")}
						>
							{t.tabs.assigned_publishers()}
						</button>
					</nav>
				</div>

				{#if activeTab === "orders"}
					<SupplierOrdersView {app} {supplierId} pageData={ordersViewData} />
				{:else}
					<SupplierPublishersView {app} {supplierId} pageData={publishersViewData} />
				{/if}
			</div>
		</div>
	</div>
</Page>

<PageCenterDialog {dialog} title="" description="">
	{#if supplier}
		<SupplierMetaForm
			heading={t.details.update_supplier_details()}
			saveLabel={t.labels.save()}
			data={defaults(
				{ ...stripNulls(supplier), underdeliveryPolicy: supplier.underdelivery_policy === 1 ? "queue" : "pending" },
				zod(supplierSchema($LL))
			)}
			options={{
				SPA: true,
				validators: zod(supplierSchema($LL)),
				onUpdate: ({ form }) => {
					if (form.valid) {
						handleUpdateSupplier(form.data);
					}
				}
			}}
			formatList={orderFormats}
			onCancel={() => dialogOpen.set(false)}
		/>
	{/if}
</PageCenterDialog>

<PageCenterDialog dialog={deleteDialog} title="" description={$LL.common.delete_supplier_dialog.description()}>
	{#if supplier}
		<SupplierDeleteForm
			displayName={supplier.name}
			options={{
				SPA: true,
				validators: zod(
					supplierDeleteSchema(
						supplier.name
							.toLowerCase()
							.replace(/[^a-z0-9]/g, "_")
							.replace(/_+/g, "_")
							.replace(/^_+|_+$/g, "")
					)
				),
				onUpdate: ({ form }) => {
					if (form.valid) {
						handleDeleteSupplier();
					}
				}
			}}
			onCancel={() => deleteDialogOpen.set(false)}
		/>
	{/if}
</PageCenterDialog>

<style global>
	:global(html) {
		overflow-x: hidden;
		height: 100%;
		margin-right: calc(-1 * (100vw - 100%));
	}

	:global(body) {
		height: 100%;
		padding: 0;
	}
</style>
