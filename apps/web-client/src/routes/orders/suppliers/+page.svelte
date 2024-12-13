<script lang="ts">
	import { Plus } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { goto } from "$lib/utils/navigation";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { customerOrderSchema } from "$lib/forms";
	import { base } from "$app/paths";
	import { supplierOrderFilterStatus, type SupplierOrderFilterStatus } from "$lib/stores/supplier-order-filters";
	import { getPossibleSupplierOrderInfos } from "$lib/db/orders/suppliers";

	import Page from "$lib/components/Page.svelte";

	import { view } from "@librocco/shared";
	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	import UnorderedTable from "$lib/components/supplier-orders/UnorderedTable.svelte";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";
	import type { LayoutData } from "./$types";

	export let data: LayoutData;
	// TODO: Replace with actual DB call
	let supplierOrders = [
		{
			supplier_name: "Science Books LTD",
			supplier_id: 1,
			total_book_number: 5,
			status: "unordered",
			created: new Date()
		},
		{
			supplier_name: "Phantasy Books LTD",
			supplier_id: 2,
			total_book_number: 3,
			status: "ordered",
			created: new Date()
		},
		{
			supplier_name: "Penguin Random House",
			supplier_id: 3,
			total_book_number: 8,
			status: "ordered",
			created: new Date()
		}
	];

	$: hasOrderedOrders = data.placedOrders.length;

	function setFilter(status: SupplierOrderFilterStatus) {
		supplierOrderFilterStatus.set(status);
	}

	function handleReconcile(event: CustomEvent<{ supplierIds: number[] }>) {
		console.log("Reconciling orders:", event.detail.supplierIds);
		// TODO: Implement reconciliation logic
	}
</script>

<header class="navbar mb-4 bg-neutral">
	<input type="checkbox" value="forest" class="theme-controller toggle" />
</header>

<main class="h-screen">
	<div class="mx-auto flex h-full max-w-5xl flex-col gap-y-10 px-4">
		<div class="flex items-center justify-between">
			<h1 class="prose text-2xl font-bold">Supplier Orders</h1>
		</div>

		<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
			{#if supplierOrders.length === 0}
				<div class="flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-base-300 p-6">
					<p class="text-center text-base-content/70">
						No supplier orders available. Create a customer order first to generate supplier orders.
					</p>
					<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
						<Plus size={20} />
						New Customer Order
					</button>
				</div>
			{:else}
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
						disabled={!hasOrderedOrders}
					>
						Ordered
					</button>
					<button class="btn-outline btn-sm btn" disabled> Received </button>
					<button class="btn-outline btn-sm btn" disabled> Completed </button>
				</div>
				{#if $supplierOrderFilterStatus === "unordered"}
					<UnorderedTable orders={data.possibleOrders} />
				{:else}
					<OrderedTable orders={data.placedOrders} on:reconcile={handleReconcile} />
				{/if}
			{/if}
		</div>
	</div>
</main>

<PageCenterDialog dialog={newOrderDialog} title="" description="">
	<CustomerOrderMetaForm
		heading="Create new order"
		saveLabel="Create"
		data={defaults(zod(customerOrderSchema))}
		options={{
			SPA: true,
			validators: zod(customerOrderSchema),
			onUpdate: ({ form }) => {
				if (form.valid) {
					// TODO: update data
				}
			},
			onUpdated: async ({ form }) => {
				if (form.valid) {
					const newCustomerId = Math.floor(Math.random() * 1000000); // Temporary ID generation
					newOrderDialogOpen.set(false);
					await goto(`${base}/orders/customers/${newCustomerId}`);
				}
			}
		}}
		onCancel={() => newOrderDialogOpen.set(false)}
	/>
</PageCenterDialog>
