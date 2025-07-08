<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import ListTodo from "$lucide/list-todo";

	import { goto } from "$lib/utils/navigation";
	import { appHash } from "$lib/paths";

	import LL from "@librocco/shared/i18n-svelte";

	import type { PlacedSupplierOrder } from "$lib/db/cr-sqlite/types";

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
	}

	function handleView(supplierOrderId: number) {
		goto(appHash("supplier_orders", supplierOrderId));
	}

	$: t = $LL.supplier_orders_component.ordered_table;
</script>

<div class="relative h-full overflow-x-auto">
	{#if hasSelectedOrders}
		<div class="absolute right-0 top-0 z-10 w-fit justify-end sm:right-3">
			<button class="btn-primary btn-sm btn flex-nowrap gap-x-2" on:click={() => handleReconcile(selectedOrders)}>
				{t.reconcile_selected({ count: selectedOrders.length })}
				<ListTodo aria-hidden focusable="false" size={20} />
			</button>
		</div>
	{/if}

	<table class="table-sm table-zebra table">
		<thead>
			<tr class="relative">
				<th scope="col" class="sr-only"> {t.select()} </th>
				<th scope="col"> {t.order_id()} </th>
				<th scope="col">{t.supplier()}</th>
				<th scope="col">{t.placed()}</th>
				<th scope="col" class="sr-only">
					{t.actions()}
				</th>
			</tr>
		</thead>
		<tbody>
			{#each orders as { supplier_name, created, id, reconciled = false }}
				{@const placed = new Date(created)}

				<tr class="hover focus-within:bg-base-200 hover:cursor-pointer">
					<td class="text-center align-middle">
						<input
							disabled={reconciled}
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={selectedOrders.includes(id)}
							on:change={() => toggleOrderSelection(id)}
						/>
					</td>
					<th>
						<span class="font-medium">#{id}</span>
					</th>
					<td>{supplier_name}</td>
					<td>
						<span class="badge-primary badge-outline badge">
							<time dateTime={placed.toISOString()}>{placed.toLocaleString()}</time>
						</span>
					</td>
					<td class="whitespace-nowrap text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleView(id)}>
							{t.view_order()}
						</button>
						<button
							class="btn-primary btn-sm btn flex-nowrap gap-x-2.5"
							on:click={() => handleReconcile([id])}
							disabled={hasSelectedOrders}
						>
							{t.reconcile()}
							<ListTodo aria-hidden focusable="false" size={20} />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
