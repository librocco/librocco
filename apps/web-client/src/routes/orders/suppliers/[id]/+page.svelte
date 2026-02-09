<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { writable } from "svelte/store";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { invalidate } from "$app/navigation";
	import { page } from "$app/stores";

	import { stripNulls } from "@librocco/shared";

	import type { Supplier } from "$lib/db/cr-sqlite/types";
	import type { PageData } from "./$types";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import { Page } from "$lib/controllers";

	import { supplierSchema } from "$lib/forms/schemas";
	import { upsertSupplier, getPlacedSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";
	import OrdersView from "./OrdersView.svelte";
	import { racefreeGoto } from "$lib/utils/navigation";
	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { appPath } from "$lib/paths";
	import SupplierMetaForm from "$lib/forms/SupplierMetaForm.svelte";
	import LL from "@librocco/shared/i18n-svelte";
	import { downloadAsTextFile, generateLinesForDownload } from "$lib/utils/misc";
	import { orderFormats } from "$lib/enums/orders";

	import { app } from "$lib/app";
	import { getDb, getDbRx } from "$lib/app/db";

	import { SupplierCard } from "$lib/components-new/SupplierCard";
	import PublisherView from "./PublisherView.svelte";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;

	onMount(() => {
		// Reload add supplier data dependants when the data changes
		const disposer1 = getDbRx(app).onPoint("supplier", BigInt($page.params.id), () => invalidate("supplier:data"));
		// Changes to supplier orders, supplier publishers
		const disposer2 = getDbRx(app).onRange(["supplier_publisher", "supplier_order"], () => invalidate("supplier:orders"));
		disposer = () => (disposer1(), disposer2());
	});

	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	// #endregion reactivity
	type Tab = "orders" | "publishers";
	const activeTab = writable<Tab>("orders");
	$: goto = racefreeGoto(disposer);

	$: ({ plugins, supplier } = data);

	$: t = $LL.order_list_page;

	// #region dialog
	const dialog = createDialog(defaultDialogConfig);
	const {
		states: { open: dialogOpen }
	} = dialog;
	// #endregion dialog

	const handleUpdateSupplier = async (_data: Partial<Supplier>) => {
		const db = await getDb(app);
		const data = { ...stripNulls(supplier), ..._data };
		await upsertSupplier(db, data);
		dialogOpen.set(false);
	};

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const db = await getDb(app);

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createReconciliationOrder(db, id, event.detail.supplierOrderIds);
		goto(appPath("reconcile", id));
	}

	async function handleDownload(event: CustomEvent<{ supplierOrderId: number }>) {
		const db = await getDb(app);
		const lines = await getPlacedSupplierOrderLines(db, [event.detail.supplierOrderId]);

		const generatedLines = generateLinesForDownload(lines[0]?.customerId, lines[0]?.orderFormat, lines);

		downloadAsTextFile(generatedLines, `${event.detail.supplierOrderId}-${lines[0]?.supplier_name}-${lines[0]?.orderFormat}`);
	}

	const handleDeleteSupplier = () => {
		console.log("Delete supplier functionality not implemented in this page");
	};
</script>

<Page title={t.details.supplier_page()} view="orders/suppliers/id" {app} {plugins}>
	<div slot="main" class="h-full w-full">
		<div class="flex h-full flex-col gap-y-10 max-md:overflow-y-auto md:flex-row md:divide-x">
			<div class="min-w-fit md:basis-96 md:overflow-y-auto">
				<div class="card h-full">
					<div class="card-body p-0">
						<div class="col-span-3 overflow-auto border-[#E5E5E5] p-[20px] py-6 px-[20px]">
							{#if supplier}
								<SupplierCard
									name={supplier.name}
									id={`#${supplier?.id}`}
									email={supplier.email || "N/A"}
									address={supplier.address || "N/A"}
									orderFormat={supplier.orderFormat || "N/A"}
									on:edit={() => dialogOpen.set(true)}
									on:delete={handleDeleteSupplier}
								/>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="mb-20 flex h-full w-full flex-col gap-y-2">
				<!-- Tab Navigation -->
				<div class="z-20 bg-white px-5 pt-6 pb-6">
					<nav class="flex gap-2">
						<button
							class="rounded font-normal transition-colors {$activeTab === 'orders'
								? 'border border-gray-900 bg-gray-900 text-white'
								: 'border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-50'} px-4 py-2 text-[14px]"
							on:click={() => activeTab.set("orders")}
						>
							Orders
						</button>
						<button
							class="rounded font-normal transition-colors {$activeTab === 'publishers'
								? 'border border-gray-900 bg-gray-900 text-white'
								: 'border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-50'} px-4 py-2 text-[14px]"
							on:click={() => activeTab.set("publishers")}
						>
							Assigned Publishers
						</button>
					</nav>
				</div>

				<!-- Orders Tab -->
				{#if $activeTab === "orders"}
					<OrdersView {data} on:reconcile={handleReconcile} on:download={handleDownload} />
				{/if}

				<!-- Assigned Publishers Tab -->
				{#if $activeTab === "publishers"}
					<PublisherView {data} />
				{/if}
			</div>
		</div>
	</div>
</Page>

<PageCenterDialog {dialog} title="" description="">
	<SupplierMetaForm
		heading="Update supplier details"
		saveLabel="Save"
		data={defaults(stripNulls(supplier), zod(supplierSchema($LL)))}
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
