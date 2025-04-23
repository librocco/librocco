<script lang="ts">
	import LL from "@librocco/shared/i18n-svelte";
	import type { InventoryTableData } from "../types";

	export let data: InventoryTableData;

	// TODO: this is a duplicate
	const isBookRow = (data: InventoryTableData): data is InventoryTableData<"book"> => data.__kind !== "custom";
</script>

{#if isBookRow(data) && data.price && data.warehouseDiscount}
	<!-- Discounted price is shown only for book rows with discount other than 0 -->
	<!-- We're rendering this branch only if both the price and discount are defined - no price is handled in the other branch -->
	{@const { price, warehouseDiscount } = data}
	<div class="flex flex-col items-start gap-0.5">
		<span class="sr-only">{$LL.table_components.inventory_tables.book_price_cell.discounted_price()}:</span>
		<span data-property="discounted-price">€{((price * (100 - warehouseDiscount)) / 100).toFixed(2)}</span>
		<span class="sr-only">{$LL.table_components.inventory_tables.book_price_cell.original_price()}:</span>
		<span class="text-gray-400 line-through" data-property="full-price">(€{price.toFixed(2)})</span>
		<span class="sr-only">{$LL.table_components.inventory_tables.book_price_cell.percentage_discount()}:</span>
		<span class="text-gray-400" data-property="applied-discount">-{warehouseDiscount}%</span>
	</div>
{:else}
	<!-- Price only is shown regardless of the row being a book row without discount applied, or a custom item row -->
	<span data-property="full-price">€{data.price.toFixed(2)}</span>
{/if}
