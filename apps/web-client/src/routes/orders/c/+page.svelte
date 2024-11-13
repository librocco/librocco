<script lang="ts">
	import { Plus, UserCircle, Mail } from "lucide-svelte";
	import { data } from "./data";

	const { customers, customerOrderLines } = data;

	let selectedStatus: "in_progress" | "completed" = "in_progress";

	import { getOrderStatus } from "$lib/utils/order-status";

	$: filteredOrders = customers
		.map((customer) => {
			const orders = customerOrderLines.filter((line) => line.customer_id === customer.id);
			const status = getOrderStatus(orders);
			return {
				...customer,
				status
			};
		})
		.filter((order) => order.status === selectedStatus);
</script>

<main class="h-screen">
	<header class="navbar bg-neutral mb-4">
		<input type="checkbox" value="forest" class="theme-controller toggle" />
	</header>

	<div class="mx-auto flex h-full max-w-5xl flex-col gap-y-10 px-4">
		<div class="flex items-center justify-between">
			<h1 class="prose text-2xl font-bold">Customer Orders</h1>
			<a href="/orders/c/new" class="btn-primary btn gap-2">
				<Plus size={20} />
				New Order
			</a>
		</div>

		<div class="flex flex-col gap-y-6 overflow-x-auto">
			<div class="flex gap-2">
				<button
					class="btn-outline btn-sm btn {selectedStatus === 'in_progress' ? 'btn-primary' : ''}"
					on:click={() => (selectedStatus = "in_progress")}
				>
					In Progress
				</button>
				<button
					class="btn-outline btn-sm btn {selectedStatus === 'completed' ? 'btn-primary' : ''}"
					on:click={() => (selectedStatus = "completed")}
				>
					Completed
				</button>
			</div>
			<table class="table-lg table">
				<thead>
					<tr>
						<th scope="col">Customer</th>
						<th scope="col">Order Id</th>
						<th scope="col"> <span class="sr-only"> Link to update </span></th>
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
								<span class="italic">{id}</span>
							</td>
							<td>
								<a href="/orders/c/{id}" class="btn-outline btn-sm btn">Update</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</main>

<style>
	.table-lg td {
		padding-top: 1rem;
		padding-bottom: 1rem;
	}
</style>
