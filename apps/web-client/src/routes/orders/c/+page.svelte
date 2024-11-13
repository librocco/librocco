<script lang="ts">
	import { Plus, UserCircle, Mail } from "lucide-svelte";
	import { data } from "./data";
	import { CustomerOrderState } from "$lib/db/orders/types";

	const { customers, customerOrderLines } = data;

	let selectedStatus: "in_progress" | "completed" = "in_progress";

	$: filteredOrders = customers.map(customer => {
		const orders = customerOrderLines.filter(line => line.customer_id === customer.id);
		const status = orders.every(order => order.collected) ? "completed" : "in_progress";
		return {
			...customer,
			status
		};
	}).filter(order => order.status === selectedStatus);
</script>

<main class="h-screen">
	<header class="navbar mb-4 bg-neutral">
		<input type="checkbox" value="forest" class="theme-controller toggle" />
	</header>

	<div class="flex h-full flex-col gap-y-6 px-4">
		<div class="flex items-center justify-between">
			<h1 class="prose text-2xl font-bold">Customer Orders</h1>
			<a href="/orders/c/new" class="btn-primary btn gap-2">
				<Plus size={20} />
				New Order
			</a>
		</div>

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

		<div class="overflow-x-auto">
			<table class="table-lg table">
				<thead>
					<tr>
						<th>Customer</th>
						<th>Email</th>
						<th>Status</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredOrders as order}
						<tr class="hover">
							<td class="flex items-center gap-3">
								<UserCircle size={24} />
								{order.fullname}
							</td>
							<td class="flex items-center gap-3">
								<Mail size={20} />
								{order.email}
							</td>
							<td>
								<div
									class="badge {order.status === 'completed'
										? 'badge-success'
										: 'badge-warning'} gap-2"
								>
									{order.status === "completed" ? "Completed" : "In Progress"}
								</div>
							</td>
							<td>
								<a href="/orders/c/{order.id}" class="btn-outline btn-sm btn">Update</a>
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
