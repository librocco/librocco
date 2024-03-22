<script lang="ts">
	import type { InventoryTableData } from "../types";

	export let data: Pick<InventoryTableData, "price" | "warehouseDiscount">;

	$: ({ price, warehouseDiscount } = data);
</script>

{#if price && warehouseDiscount}
	<div class="flex flex-col items-start gap-0.5">
		<span class="sr-only">Discounted price:</span>
		<span data-property="discounted-price">€{((price * (100 - warehouseDiscount)) / 100).toFixed(2)}</span>
		<span class="sr-only">Original price:</span>
		<span class="text-gray-400 line-through" data-property="full-price">(€{price.toFixed(2)})</span>
		<span class="sr-only">Percentage discount:</span>
		<span class="text-gray-400" data-property="applied-discount">-{warehouseDiscount}%</span>
	</div>
{:else}
	<span data-property="full-price">{price ? `€${price.toFixed(2)}` : "N/A"} </span>
{/if}
