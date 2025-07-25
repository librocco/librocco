<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { invalidate } from "$app/navigation";

	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { racefreeGoto } from "$lib/utils/navigation";

	import Settings from "$lucide/settings";
	import Plus from "$lucide/plus";
	import PackageOpen from "$lucide/package-open";

	import type { PageData } from "./$types";
	import type { Customer } from "$lib/db/cr-sqlite/types";
	import { appHash } from "$lib/paths";

	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema } from "$lib/forms";
	import { Page } from "$lib/controllers";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import UnorderedTable from "$lib/components/supplier-orders/UnorderedTable.svelte";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";
	import ReconcilingTable from "$lib/components/supplier-orders/ReconcilingTable.svelte";
	import CompletedTable from "$lib/components/supplier-orders/CompletedTable.svelte";
	import PlaceholderBox from "$lib/components/Placeholders/PlaceholderBox.svelte";

	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { getCustomerDisplayIdSeq, upsertCustomer } from "$lib/db/cr-sqlite/customers";

	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	let disposer: () => void;
	onMount(() => {
		const disposer1 = data.dbCtx?.rx?.onRange(["book"], () => invalidate("books:data"));
		const disposer2 = data.dbCtx?.rx?.onRange(["supplier", "supplier_publisher"], () => invalidate("suppliers:data"));
		const disposer3 = data.dbCtx?.rx?.onRange(["customer_order_lines"], () => invalidate("customers:order_lines"));
		const disposer4 = data.dbCtx?.rx?.onRange(["reconciliation_order"], () => invalidate("reconciliation:orders"));

		disposer = () => (disposer1(), disposer2(), disposer3(), disposer4());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	$: ({ plugins, placedOrders, possibleOrders, reconcilingOrders, completedOrders } = data);
	$: db = data?.dbCtx?.db;

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	$: hasPlacedOrders = placedOrders?.length;
	$: hasReconcilingOrders = reconcilingOrders?.length;
	$: hasCompletedOrders = completedOrders?.length;

	let orderStatusFilter: "unordered" | "ordered" | "reconciling" | "completed" = "unordered";

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createReconciliationOrder(db, id, event.detail.supplierOrderIds);
		goto(appHash("reconcile", id));
	}

	const createCustomer = async (customer: Omit<Customer, "id" | "displayId">) => {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		const displayId = await getCustomerDisplayIdSeq(db).then(String);

		await upsertCustomer(db, { ...customer, id, displayId });

		newOrderDialogOpen.set(false);

		await goto(appHash("customers", id));
	};

	$: t = $LL.supplier_orders_page;
</script>

<Page title={t.title.supplier_orders()} view="orders/suppliers/orders" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-2 divide-y">
		<div class="flex flex-row justify-between gap-x-2 overflow-x-auto p-4">
			<div class="flex gap-2 px-2" role="group" aria-label="Filter orders by status">
				<button
					class="btn-sm btn {orderStatusFilter === 'unordered' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => (orderStatusFilter = "unordered")}
					aria-pressed={orderStatusFilter === "unordered"}
				>
					{t.tabs.unordered()}
				</button>

				<button
					class="btn-sm btn {orderStatusFilter === 'ordered' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => (orderStatusFilter = "ordered")}
					aria-pressed={orderStatusFilter === "ordered"}
					disabled={!hasPlacedOrders}
					data-testid="ordered-list"
				>
					{t.tabs.ordered()}
				</button>

				<button
					class="btn-sm btn {orderStatusFilter === 'reconciling' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => (orderStatusFilter = "reconciling")}
					aria-pressed={orderStatusFilter === "reconciling"}
					disabled={!hasReconcilingOrders}
					data-testid="reconciling-list"
				>
					{t.tabs.reconciling()}
				</button>
				<div class="w-fit">
					<button
						class="btn-sm btn self-end {orderStatusFilter === 'completed' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => (orderStatusFilter = "completed")}
						aria-pressed={orderStatusFilter === "completed"}
						disabled={!hasCompletedOrders}
						data-testid="reconciling-list"
					>
						{t.tabs.completed()}
					</button>
				</div>
			</div>

			<button class="btn-outline btn-sm btn gap-2" on:click={() => goto(appHash("suppliers"))}>
				{t.labels.suppliers()}
				<Settings size={20} />
			</button>
		</div>

		<div class="h-full w-full p-4">
			{#if orderStatusFilter === "unordered"}
				{#if possibleOrders.length === 0 && placedOrders.length === 0}
					<div class="mx-auto w-fit max-w-xl translate-y-1/2">
						<PlaceholderBox title={t.placeholder.title()} description={t.placeholder.description()}>
							<PackageOpen slot="icon" />

							<button slot="actions" class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
								<Plus size={20} />
								<p>{t.placeholder.button()}</p>
							</button>
						</PlaceholderBox>
					</div>
				{:else}
					<UnorderedTable orders={possibleOrders} />
				{/if}
			{:else if orderStatusFilter === "ordered"}
				<OrderedTable orders={placedOrders} on:reconcile={handleReconcile} />
			{:else if orderStatusFilter === "reconciling"}
				<ReconcilingTable orders={reconcilingOrders} />
			{:else}
				<CompletedTable orders={completedOrders} />
			{/if}
		</div>
	</div>
</Page>

<PageCenterDialog dialog={newOrderDialog} title="" description="">
	<CustomerOrderMetaForm
		heading="Create new order"
		saveLabel="Create"
		kind="create"
		data={defaults(zod(createCustomerOrderSchema("create")))}
		options={{
			SPA: true,
			validators: zod(createCustomerOrderSchema("create")),
			onUpdate: ({ form }) => {
				if (form.valid) {
					createCustomer(form.data);
				}
			}
		}}
		onCancel={() => newOrderDialogOpen.set(false)}
	/>
</PageCenterDialog>
