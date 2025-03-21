<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { invalidate } from "$app/navigation";
	import { Settings, Plus } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { racefreeGoto } from "$lib/utils/navigation";
	import { base } from "$app/paths";

	import type { PageData } from "./$types";
	import type { Customer } from "$lib/db/cr-sqlite/types";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema } from "$lib/forms";

	import UnorderedTable from "$lib/components/supplier-orders/UnorderedTable.svelte";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";
	import ReconcilingTable from "$lib/components/supplier-orders/ReconcilingTable.svelte";
	import CompletedTable from "$lib/components/supplier-orders/CompletedTable.svelte";

	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { getCustomerDisplayIdSeq, upsertCustomer } from "$lib/db/cr-sqlite/customers";

	export let data: PageData;

	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		const disposer1 = rx.onRange(["book"], () => invalidate("books:data"));
		const disposer2 = rx.onRange(["supplier", "supplier_publisher"], () => invalidate("suppliers:data"));
		const disposer3 = rx.onRange(["customer_order_lines"], () => invalidate("customers:order_lines"));
		const disposer4 = rx.onRange(["reconciliation_order"], () => invalidate("reconciliation:orders"));

		disposer = () => (disposer1(), disposer2(), disposer3(), disposer4());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data?.dbCtx?.db;

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	$: hasPlacedOrders = data.placedOrders?.length;
	$: hasReconcilingOrders = data.reconcilingOrders?.length;
	$: hasCompletedOrders = data.completedOrders?.length;

	let orderStatusFilter: "unordered" | "ordered" | "reconciling" | "completed" = "unordered";

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createReconciliationOrder(db, id, event.detail.supplierOrderIds);
		goto(`${base}/orders/suppliers/reconcile/${id}`);
	}

	const createCustomer = async (customer: Omit<Customer, "id" | "displayId">) => {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		const displayId = await getCustomerDisplayIdSeq(db).then(String);

		await upsertCustomer(db, { ...customer, id, displayId });

		newOrderDialogOpen.set(false);

		await goto(`${base}/orders/customers/${id}`);
	};
</script>

<header class="navbar mb-4 bg-neutral">
	<input type="checkbox" value="forest" class="theme-controller toggle" />
</header>

<main class="h-screen">
	<div class="mx-auto flex h-full max-w-5xl flex-col gap-y-10 px-4">
		<div class="flex items-center justify-between">
			<h1 class="prose text-2xl font-bold">Supplier Orders</h1>
			<button class="btn-outline btn-sm btn gap-2" on:click={() => goto(`${base}/orders/suppliers/`)}>
				Suppliers
				<Settings size={20} />
			</button>
		</div>

		<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
			<div class="flex gap-2 px-2" role="group" aria-label="Filter orders by status">
				<button
					class="btn-sm btn {orderStatusFilter === 'unordered' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => (orderStatusFilter = "unordered")}
					aria-pressed={orderStatusFilter === "unordered"}
				>
					Unordered
				</button>

				<button
					class="btn-sm btn {orderStatusFilter === 'ordered' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => (orderStatusFilter = "ordered")}
					aria-pressed={orderStatusFilter === "ordered"}
					disabled={!hasPlacedOrders}
					data-testid="ordered-list"
				>
					Ordered
				</button>

				<button
					class="btn-sm btn {orderStatusFilter === 'reconciling' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => (orderStatusFilter = "reconciling")}
					aria-pressed={orderStatusFilter === "reconciling"}
					disabled={!hasReconcilingOrders}
					data-testid="reconciling-list"
				>
					Reconciling
				</button>

				<button
					class="btn-sm btn {orderStatusFilter === 'completed' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => (orderStatusFilter = "completed")}
					aria-pressed={orderStatusFilter === "completed"}
					disabled={!hasCompletedOrders}
					data-testid="reconciling-list"
				>
					Completed
				</button>
			</div>

			{#if orderStatusFilter === "unordered"}
				{#if data?.possibleOrders.length === 0 && data?.placedOrders.length === 0}
					<div class="flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-base-300 p-6">
						<p class="text-center text-base-content/70">
							No unordered supplier orders available. Create a customer order first to generate supplier orders.
						</p>
						<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
							<Plus size={20} />
							New Customer Order
						</button>
					</div>
				{:else}
					<UnorderedTable orders={data.possibleOrders} />
				{/if}
			{:else if orderStatusFilter === "ordered"}
				<OrderedTable orders={data.placedOrders} on:reconcile={handleReconcile} />
			{:else if orderStatusFilter === "reconciling"}
				<ReconcilingTable orders={data.reconcilingOrders} />
			{:else}
				<CompletedTable orders={data.completedOrders} />
			{/if}
		</div>
	</div>
</main>

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
