<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { Plus } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { invalidate } from "$app/navigation";
	import { racefreeGoto } from "$lib/utils/navigation";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema } from "$lib/forms";

	import { base } from "$app/paths";

	import type { PageData } from "./$types";
	import { getCustomerDisplayIdSeq, upsertCustomer } from "$lib/db/cr-sqlite/customers";
	import type { Customer } from "$lib/db/cr-sqlite/types";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload all customer order/customer order line data dependants when the data changes
		disposer = rx.onRange(["customer", "customer_order_lines"], () => invalidate("customer:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	$: customerOrders = data.customerOrders;

	/**
	 * Toggle between in-progress and completed orders:
	 */
	let orderFilterStatus: "completed" | "in_progress" = "in_progress";
	function setFilter(status: "completed" | "in_progress") {
		orderFilterStatus = status;
	}

	$: hasCompletedOrders = customerOrders.some(({ completed }) => completed);

	$: filteredOrders = customerOrders.filter(({ completed }) => completed === (orderFilterStatus === "completed"));

	const createCustomer = async (customer: Omit<Customer, "id" | "displayId">) => {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		// NOTE: dbCtx should always be defined on client
		const { db } = data.dbCtx;

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
			<h1 class="prose text-2xl font-bold">Customer Orders</h1>
			<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
				<Plus size={20} />
				New Order
			</button>
		</div>

		<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
			{#if !customerOrders.length}
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
						class="btn-sm btn {orderFilterStatus === 'in_progress' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("in_progress")}
						aria-pressed={orderFilterStatus === "in_progress"}
					>
						In Progress
					</button>
					<button
						class="btn-sm btn {orderFilterStatus === 'completed' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("completed")}
						aria-pressed={orderFilterStatus === "completed"}
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
						{#each filteredOrders as { id, fullname, email, displayId }}
							<tr class="hover focus-within:bg-base-200">
								<td>
									<dl class="flex flex-col gap-y-1">
										<dt class="sr-only">Customer details</dt>
										<dd>{fullname}</dd>
										<dd class="text-sm">{email ?? ""}</dd>
									</dl>
								</td>
								<td>
									<span class="font-medium">{displayId}</span>
								</td>
								<td class="text-right">
									<a href="{base}/orders/customers/{id}/" class="btn-outline btn-sm btn">Update</a>
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

<style>
	.table-lg td {
		padding-top: 1rem;
		padding-bottom: 1rem;
	}
</style>
