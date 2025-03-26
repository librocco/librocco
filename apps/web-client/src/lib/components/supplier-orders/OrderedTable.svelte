<script lang="ts">
	import { ListTodo } from "lucide-svelte";
	import type { PlacedSupplierOrder } from "$lib/db/cr-sqlite/types";
	import { goto } from "$lib/utils/navigation";
	import { base } from "$app/paths";
	import { createEventDispatcher } from "svelte";

	export let orders: Array<PlacedSupplierOrder & { reconciled?: boolean }>;

	let selectedOrders: Array<number>;
	$: selectedOrders = [];
	$: hasSelectedOrders = selectedOrders.length > 0;

	/**@TODO validate for isbn */
	function toggleOrderSelection(supplierOrderId: number) {
		if (selectedOrders.includes(supplierOrderId)) {
			selectedOrders = selectedOrders.filter((id) => id !== supplierOrderId);
		} else {
			selectedOrders = [...selectedOrders, supplierOrderId];
		}
	}
	const dispatch = createEventDispatcher<{ reconcile: { supplierOrderIds: number[] } }>();

	async function handleReconcile(supplierOrderIds: number[]) {
		/** @TODO replace with SOIds */
		dispatch("reconcile", { supplierOrderIds: supplierOrderIds });
		// goto(`${base}/orders/suppliers/reconcile?ids=${supplierId}`);
	}
	function handleView(supplierOrderId: number) {
		goto(`${base}/orders/suppliers/orders/${supplierOrderId}`);
	}
	function handleViewReconcileOrder(id: number) {
		goto(`${base}/orders/suppliers/reconcile/${id}`);
	}
</script>

<div class="overflow-x-auto">
	<table class="table-pin-rows table-lg table whitespace-nowrap">
		<thead>
			<tr>
				<th scope="col" class="w-16">
					<span class="sr-only">Select</span>
				</th>
				<th scope="col">Supplier</th>
				<th scope="col">Books</th>
				<th scope="col">Placed</th>
				<th scope="col"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#if hasSelectedOrders}
				<tr aria-live="polite" aria-atomic="true" class="bg-base-200">
					<td role="cell"></td>
					<th role="columnheader" scope="row">
						<span class="sr-only">Selected orders summary: </span>
						{selectedOrders.length} orders selected
					</th>
					<td role="cell"></td>
					<td role="cell"></td>
					<td role="cell" class="text-right">
						<button
							class="btn-primary btn-sm btn flex-nowrap gap-x-2"
							on:click={() => handleReconcile(selectedOrders)}
							aria-label="Reconcile {selectedOrders.length} selected orders"
						>
							<ListTodo aria-hidden focusable="false" size={20} />

							Reconcile Selected
						</button>
					</td>
				</tr>
			{/if}
			{#each orders as { supplier_name, total_book_number, created, id, reconciled = false, reconciliation_order_id }}
				<tr class="hover focus-within:bg-base-200">
					<td>
						<input
							disabled={reconciled}
							type="checkbox"
							class="checkbox"
							checked={selectedOrders.includes(id)}
							on:change={() => toggleOrderSelection(id)}
						/>
					</td>
					<td>{supplier_name}</td>
					<td>{total_book_number}</td>
					<td>
						<span class="badge-primary badge-outline badge">
							{new Date(created).toLocaleString()}
						</span>
					</td>
					<td class="flex items-center justify-evenly text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleView(id)}> View Order </button>
						{#if !hasSelectedOrders && !reconciled}
							<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleReconcile([id])}>
								<ListTodo aria-hidden focusable="false" size={20} />
								Reconcile
							</button>
						{/if}
						{#if !hasSelectedOrders && reconciled}
							<button
								class="btn-primary btn-sm btn flex-nowrap gap-x-2.5"
								on:click={() => handleViewReconcileOrder(reconciliation_order_id)}
							>
								<ListTodo aria-hidden focusable="false" size={20} />
								View Reconciliation
							</button>
						{/if}
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
