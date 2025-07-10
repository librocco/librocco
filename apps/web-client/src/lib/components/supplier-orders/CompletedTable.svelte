<script lang="ts">
	import { goto } from "$lib/utils/navigation";
	import { appHash } from "$lib/paths";

	import type { PlacedSupplierOrder } from "$lib/db/cr-sqlite/types";

	import LL from "@librocco/shared/i18n-svelte";

	export let orders: PlacedSupplierOrder[];

	function handleView(supplierOrderId: number) {
		goto(appHash("supplier_orders", supplierOrderId));
	}
	function handleViewReconcileOrder(id: number) {
		goto(appHash("reconcile", id));
	}

	$: t = $LL.supplier_orders_component.completed_table;
</script>

<div class="overflow-x-auto">
	<table class="table-sm table">
		<thead>
			<tr>
				<th scope="col">{t.supplier_id()}</th>
				<th scope="col">{t.supplier()}</th>
				<th scope="col">{t.finalized()}</th>
				<th scope="col" class="sr-only">{t.actions()}</th>
			</tr>
		</thead>

		<tbody>
			{#each orders as { id, supplier_name, reconciliation_order_id, reconciliation_last_updated_at }}
				<!-- We take the last updatedAt of the reconciliation order as the date it was finalised -->
				{@const finalized = new Date(reconciliation_last_updated_at)}

				<tr>
					<th>
						<span class="font-medium">#{id}</span>
					</th>
					<td class="whitespace-nowrap">{supplier_name}</td>
					<td>
						<span class="badge-primary badge-outline badge">
							<time dateTime={finalized.toISOString()}>
								{finalized.toLocaleString()}
							</time>
						</span>
					</td>
					<td class="whitespace-nowrap text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleView(id)}>
							{t.view_order()}
						</button>

						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleViewReconcileOrder(reconciliation_order_id)}>
							{t.view_reconciliation()}
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
