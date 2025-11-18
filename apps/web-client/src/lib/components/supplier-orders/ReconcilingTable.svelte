<script lang="ts">
	import ClockArrowUp from "$lucide/clock-arrow-up";
	import ListTodo from "$lucide/list-todo";
	import SquareArrow from "$lucide/square-arrow-out-up-right";

	import { goto } from "$lib/utils/navigation";
	import type { ReconciliationOrder } from "$lib/db/cr-sqlite/types";
	import LL from "@librocco/shared/i18n-svelte";
	import { formatters as dateFormatters } from "@librocco/shared/i18n-formatters";
	import { appHash } from "$lib/paths";

	function handleUpdateOrder(reconciliationOrderId: number) {
		goto(appHash("reconcile", reconciliationOrderId));
	}
	export let orders: Array<ReconciliationOrder>;

	$: t = $LL.supplier_orders_component.reconciling_table;
</script>

<div class="overflow-x-auto">
	<table class="table-sm table">
		<thead>
			<tr>
				<th scope="col">{t.order_id()}</th>
				<th scope="col">{t.supplier_orders()}</th>
				<th scope="col">{t.last_updated()}</th>
				<th scope="col" class="sr-only">{t.actions()}</th>
			</tr>
		</thead>
		<tbody>
			{#each orders as { id, supplierOrderIds, updatedAt }}
				{@const updatedDate = new Date(updatedAt)}
				<tr class="hover focus-within:bg-base-200 hover:cursor-pointer" on:click={() => handleUpdateOrder(id)}>
					<th>
						<span class="font-medium">#{id}</span>
					</th>
					<td>
						<div class="flex flex-wrap gap-1">
							{#each supplierOrderIds as supplier_id}
								<a class="badge-primary badge gap-x-2 hover:badge-outline" href={appHash("supplier_orders", supplier_id)}>
									#{supplier_id}
									<SquareArrow size={12} />
								</a>
							{/each}
						</div>
					</td>
					<td>
					<span class="badge-primary badge-outline badge badge-md gap-x-2 py-2.5">
						<ClockArrowUp size={16} aria-hidden />
						<time dateTime={updatedDate.toISOString()}>{$dateFormatters.dateTime(updatedDate)}</time>
					</span>
					</td>
					<td class="text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleUpdateOrder(id)}>
							{t.continue()}
							<ListTodo aria-hidden focusable="false" size={20} />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
