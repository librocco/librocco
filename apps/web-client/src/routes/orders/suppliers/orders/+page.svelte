<script lang="ts">
	import { Settings, Plus } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { goto } from "$lib/utils/navigation";
	import { base } from "$app/paths";

	import type { PageData } from "./$types";
	import type { Customer } from "$lib/db/cr-sqlite/types";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema } from "$lib/forms";

	import { supplierOrderFilterStatus, type SupplierOrderFilterStatus } from "$lib/stores/supplier-order-filters";
	import UnorderedTable from "$lib/components/supplier-orders/UnorderedTable.svelte";
	import ReconcilingTable from "$lib/components/supplier-orders/ReconcilingTable.svelte";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";

	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { getCustomerDisplayIdSeq, upsertCustomer } from "$lib/db/cr-sqlite/customers";
	import { upsertBook } from "$lib/db/cr-sqlite/books";

	export let data: PageData;

	$: db = data?.dbCtx?.db;

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	$: hasReconcilingOrders = data.reconcilingOrders.length;
	$: hasPlacedOrders = data.placedOrders.length;

	function setFilter(status: SupplierOrderFilterStatus) {
		supplierOrderFilterStatus.set(status);
	}

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		const id = await createReconciliationOrder(db, event.detail.supplierOrderIds);
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
					class="btn-sm btn {$supplierOrderFilterStatus === 'unordered' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => setFilter("unordered")}
					aria-pressed={$supplierOrderFilterStatus === "unordered"}
				>
					Unordered
				</button>
				<button
					class="btn-sm btn {$supplierOrderFilterStatus === 'ordered' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => setFilter("ordered")}
					aria-pressed={$supplierOrderFilterStatus === "ordered"}
					disabled={!hasPlacedOrders}
					data-testid="ordered-list"
				>
					Ordered
				</button>
				<button
					class="btn-sm btn {$supplierOrderFilterStatus === 'reconciling' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => setFilter("reconciling")}
					aria-pressed={$supplierOrderFilterStatus === "reconciling"}
					disabled={!hasReconcilingOrders}
					data-testid="reconciling-list"
				>
					Reconciling
				</button>
				<button class="btn-outline btn-sm btn" disabled> Completed </button>
			</div>

			{#if $supplierOrderFilterStatus === "unordered"}
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
			{:else if $supplierOrderFilterStatus === "ordered"}
				<OrderedTable orders={data.placedOrders} on:reconcile={handleReconcile} />
			{:else}
				<ReconcilingTable orders={data.reconcilingOrders} />
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
