<script lang="ts">
	import { Plus } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { goto } from "$app/navigation";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { customerOrderSchema } from "$lib/forms";
	import { base } from "$app/paths";
	import { supplierOrderFilterStatus, type SupplierOrderFilterStatus } from "$lib/stores/supplier-order-filters";
	import { getPossibleSupplerOrderInfos } from "$lib/db/orders/suppliers";

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	// TODO: Replace with actual DB call
	let supplierOrders = [
		{
			supplier_name: "Science Books LTD",
			supplier_id: 1,
			total_book_number: 5,
			status: "unordered"
		},
		{
			supplier_name: "Phantasy Books LTD",
			supplier_id: 2,
			total_book_number: 3,
			status: "ordered"
		}
	];

	$: hasOrderedOrders = supplierOrders.some((order) => order.status === "ordered");
	$: filteredOrders = supplierOrders.filter((order) => order.status === $supplierOrderFilterStatus);

	function setFilter(status: SupplierOrderFilterStatus) {
		supplierOrderFilterStatus.set(status);
	}

	function handlePlaceOrder(supplierId: number) {
		// TODO: Implement order placement
		console.log("Placing order for supplier:", supplierId);
	}
</script>

<main class="h-screen">
	<header class="navbar bg-neutral mb-4">
		<input type="checkbox" value="forest" class="theme-controller toggle" />
	</header>

	<div class="mx-auto flex h-full max-w-5xl flex-col gap-y-10 px-4">
		<div class="flex items-center justify-between">
			<h1 class="prose text-2xl font-bold">Supplier Orders</h1>
		</div>

		<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
			{#if supplierOrders.length === 0}
				<div class="border-base-300 flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed p-6">
					<p class="text-base-content/70 text-center">
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
					<button class="btn-sm btn btn-outline" disabled> Received </button>
					<button class="btn-sm btn btn-outline" disabled> Completed </button>
				</div>
				<table class="table-lg table">
					<thead>
						<tr>
							<th scope="col">Supplier</th>
							<th scope="col">Books</th>
							<th scope="col"> <span class="sr-only"> Place order </span></th>
						</tr>
					</thead>
					<tbody>
						{#each filteredOrders as { supplier_name, supplier_id, total_book_number }}
							<tr class="hover focus-within:bg-base-200">
								<td>{supplier_name}</td>
								<td>{total_book_number}</td>
								<td>
									{#if $supplierOrderFilterStatus === "unordered"}
										<button class="btn-primary btn-sm btn" on:click={() => handlePlaceOrder(supplier_id)}> Place Order </button>
									{:else}
										<span class="badge badge-success">Order Placed</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
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
					await goto(`${base}/orders/c/${newCustomerId}`);
				}
			}
		}}
		onCancel={() => newOrderDialogOpen.set(false)}
	/>
</PageCenterDialog>

<style>
	.table-lg td {
		padding-top: 1rem;
		padding-bottom: 1rem;
	}
</style>
