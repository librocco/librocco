<script lang="ts">
	import { Plus } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { goto } from "$lib/utils/navigation";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { customerOrderSchema } from "$lib/forms";
	import { getOrderStatus } from "$lib/utils/order-status";
	import { orderFilterStatus, type OrderFilterStatus } from "$lib/stores/order-filters";
	import { base } from "$app/paths";

	import Page from "$lib/components/Page.svelte";
	import { view } from "@librocco/shared";
	import type { PageData } from "./$types";
	import { upsertCustomer } from "$lib/db/orders/customers";
	import { appPath } from "$lib/paths";
	import type { Customer } from "$lib/db/orders/types";

	export let data: PageData;

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	const { customers, customerOrderLines } = data;

	const newCustomerId = Math.floor(Math.random() * 1000000); // Temporary ID generation
	$: ordersWithStatus = customers.map((customer) => {
		const orders = customerOrderLines.filter((line) => line.customer_id.toString() === customer.id.toString());
		const status = getOrderStatus(orders);
		return {
			...customer,
			status
		};
	});

	$: hasCompletedOrders = ordersWithStatus.some((order) => order.status === "completed");

	$: filteredOrders = ordersWithStatus.filter((order) => order.status === $orderFilterStatus);

	function setFilter(status: OrderFilterStatus) {
		orderFilterStatus.set(status);
	}

	const createCustomer = async (customer: Customer) => {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1
		await upsertCustomer(data.ordersDb, { ...customer, id: newCustomerId });
	};
</script>

<header class="navbar mb-4 bg-neutral">
	<input type="checkbox" value="forest" class="theme-controller toggle" />
</header>

<main class="h-screen">
	<div class="mx-auto flex h-full max-w-5xl flex-col gap-y-10 px-4">
		<div class="flex items-center justify-between">
			<h1 class="prose text-2xl font-bold">Customer Orders</h1>
			<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
				<Plus size={20} />
				New Order
			</button>
		</div>

		<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
			{#if customers.length === 0}
				<div class="flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-base-300 p-6">
					<p class="text-center text-base-content/70">No customer orders yet. Create your first order to get started.</p>
					<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
						<Plus size={20} />
						New Order
					</button>
				</div>
			{:else}
				<div class="flex gap-2 px-2" role="group" aria-label="Filter orders by status">
					<button
						class="btn-sm btn {$orderFilterStatus === 'in_progress' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("in_progress")}
						aria-pressed={$orderFilterStatus === "in_progress"}
					>
						In Progress
					</button>
					<button
						class="btn-sm btn {$orderFilterStatus === 'completed' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("completed")}
						aria-pressed={$orderFilterStatus === "completed"}
						disabled={!hasCompletedOrders}
					>
						Completed
					</button>
				</div>
				<table class="table-lg table">
					<thead>
						<tr>
							<th scope="col">Customer</th>
							<th scope="col">Order Id</th>
							<th scope="col"> <span class="sr-only"> Update order </span></th>
						</tr>
					</thead>
					<tbody>
						{#each filteredOrders as { fullname, email, id }}
							<tr class="hover focus-within:bg-base-200">
								<td>
									<dl class="flex flex-col gap-y-1">
										<dt class="sr-only">Customer details</dt>
										<dd>{fullname}</dd>
										<dd class="text-sm">{email}</dd>
									</dl>
								</td>
								<td>
									<span class="font-medium">{id}</span>
								</td>
								<td class="text-right">
									<a href="{base}/orders/customers/{id}" class="btn-outline btn-sm btn">Update</a>
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
					createCustomer(form.data);
				}
			},
			onUpdated: async ({ form }) => {
				if (form.valid) {
					data.customers = [...data.customers, { ...form.data, id: newCustomerId }];
					newOrderDialogOpen.set(false);
					await goto(`${base}/orders/customers/${newCustomerId}`);
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
