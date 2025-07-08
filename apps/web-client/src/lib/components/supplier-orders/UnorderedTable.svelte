<script lang="ts">
	import Truck from "$lucide/truck";

	export let orders: Array<{
		supplier_name: string;
		supplier_id: number;
		total_book_number: number;
	}>;

	import { goto } from "$lib/utils/navigation";
	import LL from "@librocco/shared/i18n-svelte";
	import { appHash } from "$lib/paths";

	function handlePlaceOrder(supplierId: number) {
		goto(appHash("suppliers", supplierId, "new-order"));
	}

	$: t = $LL.supplier_orders_component.unordered_table;
</script>

<div class="overflow-x-auto">
	<table class="table-sm table-zebra table">
		<thead>
			<tr>
				<th scope="col">{t.supplier_id()}</th>
				<th scope="col">{t.supplier()}</th>
				<th scope="col">{t.books()}</th>
				<th scope="col" class="sr-only">{t.actions()}</th>
			</tr>
		</thead>
		<tbody>
			{#each orders as { supplier_name, supplier_id, total_book_number }}
				<tr class="hover focus-within:bg-base-200 hover:cursor-pointer" on:click={() => handlePlaceOrder(supplier_id)}>
					<th>
						<span class="font-medium">#{supplier_id}</span>
					</th>
					<td>{supplier_name}</td>
					<td>{total_book_number}</td>
					<td class="text-right">
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handlePlaceOrder(supplier_id)}>
							{t.place_order()}
							<Truck aria-hidden focusable="false" size={20} />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
