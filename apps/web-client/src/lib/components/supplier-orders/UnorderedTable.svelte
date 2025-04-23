<script lang="ts">
	import { Truck } from "lucide-svelte";

	export let orders: Array<{
		supplier_name: string;
		supplier_id: number;
		total_book_number: number;
	}>;

	import { base } from "$app/paths";
	import { goto } from "$lib/utils/navigation";
	import LL from "@librocco/shared/i18n-svelte";

	function handlePlaceOrder(supplierId: number) {
		goto(`${base}/orders/suppliers/${supplierId}/new-order`);
	}
</script>

<div class="overflow-x-auto">
	<table class="table-lg table whitespace-nowrap">
		<thead>
			<tr>
				<th scope="col">{$LL.supplier_orders_component.unordered_table.supplier()}</th>
				<th scope="col">{$LL.supplier_orders_component.unordered_table.books()}</th>
				<th scope="col"><span class="sr-only">{$LL.supplier_orders_component.unordered_table.place_order()}</span></th>
			</tr>
		</thead>
		<tbody>
			{#each orders as { supplier_name, supplier_id, total_book_number }}
				<tr class="hover focus-within:bg-base-200">
					<td>{supplier_name}</td>
					<td>{total_book_number}</td>
					<td class="text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handlePlaceOrder(supplier_id)}>
							<Truck aria-hidden focusable="false" size={20} />
							{$LL.supplier_orders_component.unordered_table.place_order()}
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
