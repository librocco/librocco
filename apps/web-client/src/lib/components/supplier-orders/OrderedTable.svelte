<script lang="ts">
	import { ListTodo } from "lucide-svelte";
	import { createEventDispatcher } from "svelte";

	export let orders: Array<{
		supplier_name: string;
		supplier_id: number;
		total_book_number: number;
		created: Date;
	}>;

	const dispatch = createEventDispatcher();

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
		dispatch("reconcile", { supplierIds: [supplierId] });
	}

	function handleBulkReconcile() {
		dispatch("reconcile", { supplierIds: Array.from(selectedOrders) });
	}
</script>

<table class="table-pin-rows table-lg table">
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
						class="btn-primary btn-sm btn gap-x-2"
						on:click={handleBulkReconcile}
						aria-label="Reconcile {selectedOrders.length} selected orders"
					>
						<ListTodo aria-hidden focusable="false" size={20} />

						Reconcile Selected
					</button>
				</td>
			</tr>
		{/if}
		{#each orders as { supplier_name, supplier_id, total_book_number, created }}
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
						{created.toLocaleDateString()}
					</span>
				</td>
				<td class="text-right">
					{#if !hasSelectedOrders}
						<button class="btn-primary btn-sm btn gap-x-2.5" on:click={() => handleReconcile(supplier_id)}>
							<ListTodo aria-hidden focusable="false" size={20} />
							Reconcile
						</button>
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.table-lg td {
		padding-top: 1rem;
		padding-bottom: 1rem;
	}
</style>
