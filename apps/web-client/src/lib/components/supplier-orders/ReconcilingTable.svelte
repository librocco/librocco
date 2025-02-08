<script lang="ts">
	import { ClockArrowUp, Scan } from "lucide-svelte";

	import { base } from "$app/paths";
	import { goto } from "$lib/utils/navigation";
	import type { ReconciliationOrder } from "$lib/db/cr-sqlite/types";
	import { appPath } from "$lib/paths";

	function handleUpdateOrder(reconciliationOrderId: number) {
		goto(`${base}/orders/suppliers/reconcile/${reconciliationOrderId}`);
	}
	export let orders: Array<ReconciliationOrder>;
</script>

<div class="overflow-x-auto">
	<table class="table-lg table whitespace-nowrap">
		<thead>
			<tr>
				<th scope="col">Order Id</th>
				<th scope="col">Supplier Orders</th>
				<th scope="col">Last Updated</th>
				<th scope="col"></th>
				<th scope="col"><span class="sr-only">Update order</span></th>
			</tr>
		</thead>
		<tbody>
			{#each orders as { id, supplierOrderIds, created, updatedAt }}
				<tr class="hover focus-within:bg-base-200">
					<td>{id}</td>
					<!-- @TODO replace with supplierOrderIds parse array??? -->
					<td>
						{#each supplierOrderIds as supplier_id}
							<a class="hover:underline" href={appPath("supplier_orders", supplier_id)}>#{supplier_id} </a>
						{/each}
					</td>
					<td>
						<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
							<span class="sr-only">Last updated</span>
							<ClockArrowUp size={16} aria-hidden />
							<time dateTime={new Date(updatedAt).toISOString()}>{new Date(updatedAt).toLocaleString()}</time>
						</span></td
					>
					<td> </td>
					<td class="text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleUpdateOrder(id)}>
							<Scan aria-hidden focusable="false" size={20} />
							Continue
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-lg td {
		padding-top: 1rem;
		padding-bottom: 1rem;
	}
</style>
