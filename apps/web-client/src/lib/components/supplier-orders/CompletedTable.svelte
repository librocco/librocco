<script lang="ts">
	import ListTodo from "$lucide/list-todo";
	import type { PlacedSupplierOrder } from "$lib/db/cr-sqlite/types";
	import { goto } from "$lib/utils/navigation";
	import LL from "@librocco/shared/i18n-svelte";
	import { appHash } from "$lib/paths";

	export let orders: PlacedSupplierOrder[];

	function handleView(supplierOrderId: number) {
		goto(appHash("supplier_orders", supplierOrderId));
	}
	function handleViewReconcileOrder(id: number) {
		goto(appHash("reconcile", id));
	}
</script>

<div class="overflow-x-auto">
	<table class="table-pin-rows table-lg table whitespace-nowrap">
		<thead>
			<tr>
				<th scope="col">{$LL.supplier_orders_component.completed_table.supplier()}</th>
				<th scope="col">{$LL.supplier_orders_component.completed_table.books()}</th>
				<th scope="col">{$LL.supplier_orders_component.completed_table.placed()}</th>
				<th scope="col"><span class="sr-only">{$LL.supplier_orders_component.completed_table.actions()}</span></th>
			</tr>
		</thead>

		<tbody>
			{#each orders as { supplier_name, total_book_number, created, id, reconciliation_order_id }}
				<tr class="hover focus-within:bg-base-200">
					<td>{supplier_name}</td>

					<td>{total_book_number}</td>

					<td>
						<span class="badge-primary badge-outline badge">
							{new Date(created).toLocaleString()}
						</span>
					</td>

					<td class="flex items-center justify-evenly text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleView(id)}
							>{$LL.supplier_orders_component.completed_table.view_order()}</button
						>

						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleViewReconcileOrder(reconciliation_order_id)}>
							<ListTodo aria-hidden focusable="false" size={20} />
							{$LL.supplier_orders_component.completed_table.view_reconciliation()}
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
