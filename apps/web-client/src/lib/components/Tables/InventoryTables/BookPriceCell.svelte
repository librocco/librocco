<script lang="ts">
	import type { InventoryTableData } from "../types";

	export let data: Pick<InventoryTableData, "price" | "warehouseDiscount">;

	$: ({ price, warehouseDiscount } = data);
</script>

{#if price && warehouseDiscount}
	<div class="flex flex-col items-start gap-0.5">
		<span class="sr-only">Discounted price:</span>
		<span>€{Math.round(price * (100 - warehouseDiscount)) / 100}</span>
		<span class="sr-only">Original price:</span>
		<span class="text-gray-400 line-through">(€{price})</span>
		<span class="sr-only">Percentage discount:</span>
		<span class="text-gray-400">-{warehouseDiscount}%</span>
	</div>
{:else}
	{price ? `€${price}` : "N/A"}
{/if}
