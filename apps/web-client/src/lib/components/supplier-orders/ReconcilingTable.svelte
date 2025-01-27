<script lang="ts">
	import { ClockArrowUp, Scan } from "lucide-svelte";

	import { base } from "$app/paths";
	import { goto } from "$lib/utils/navigation";
	import type { ReconciliationOrder } from "$lib/db/cr-sqlite/types";

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
				<th scope="col">Supplier Order Ids</th>
				<th scope="col">Last Updated</th>
				<th scope="col">Created</th>
				<th scope="col"><span class="sr-only">Update order</span></th>
			</tr>
		</thead>
		<tbody>
			{#each orders as { id, supplier_order_ids, created, updatedAt }}
				<tr class="hover focus-within:bg-base-200">
					<td>{id}</td>
					<!-- @TODO replace with supplierOrderIds parse array??? -->
					<td>Includes Orders #{(JSON.parse(supplier_order_ids) || []).join(", ")}</td>
					<td>
						<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
							<span class="sr-only">Last updated</span>
							<ClockArrowUp size={16} aria-hidden />
							<time dateTime={new Date(updatedAt).toISOString()}>{new Date(updatedAt).toLocaleString()}</time>
						</span></td
					>
					<td>
						<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
							<span class="sr-only">Created</span>
							<ClockArrowUp size={16} aria-hidden />
							<time dateTime={new Date(created).toISOString()}>{new Date(created).toDateString()}</time>
						</span></td
					>
					<td class="text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleUpdateOrder(id)}>
							<Scan aria-hidden focusable="false" size={20} />
							Update Order
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
