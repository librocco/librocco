<script lang="ts">
	import { ListTodo } from "lucide-svelte";
	import type { SupplierPlacedOrder } from "$lib/db/cr-sqlite/types";
	import { goto } from "$lib/utils/navigation";
	import { base } from "$app/paths";

	export let orders: Array<SupplierPlacedOrder>;

	let selectedOrders: Array<number>;
	$: selectedOrders = [];
	$: hasSelectedOrders = selectedOrders.length > 0;

	function toggleOrderSelection(supplierId: number) {
		if (selectedOrders.includes(supplierId)) {
			selectedOrders = selectedOrders.filter((id) => id !== supplierId);
		} else {
			selectedOrders = [...selectedOrders, supplierId];
		}
	}

	function handleReconcile(supplierId: number) {
		goto(`${base}/orders/suppliers/reconcile?ids=${supplierId}`);
	}
	function handleView(supplierOrderId: number) {
		goto(`${base}/orders/suppliers/order/${supplierOrderId}`);
	}

	function handleBulkReconcile() {
		const ids = Array.from(selectedOrders).join(",");
		goto(`${base}/orders/suppliers/reconcile?ids=${ids}`);
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
					<td role="cell" />
					<th role="columnheader" scope="row">
						<span class="sr-only">Selected orders summary: </span>
						{selectedOrders.length} orders selected
					</th>
					<td role="cell" />
					<td role="cell" />
					<td role="cell" class="text-right">
						<button
							class="btn-primary btn-sm btn flex-nowrap gap-x-2"
							on:click={handleBulkReconcile}
							aria-label="Reconcile {selectedOrders.length} selected orders"
						>
							<ListTodo aria-hidden focusable="false" size={20} />

							Reconcile Selected
						</button>
					</td>
				</tr>
			{/if}
			{#each orders as { supplier_name, supplier_id, total_book_number, created, id }}
				<tr class="hover focus-within:bg-base-200">
					<td>
						<input
							type="checkbox"
							class="checkbox"
							checked={selectedOrders.includes(supplier_id)}
							on:change={() => toggleOrderSelection(supplier_id)}
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
						{#if !hasSelectedOrders}
							<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleReconcile(supplier_id)}>
								<ListTodo aria-hidden focusable="false" size={20} />
								Reconcile
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
