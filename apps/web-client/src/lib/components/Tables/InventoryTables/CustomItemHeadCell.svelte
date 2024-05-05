<script lang="ts">
	import BodyMultiRow from "../Cells/BodyMultiRow.svelte";
	import type { InventoryTableData } from "../types";

	export let data: Pick<InventoryTableData, "title" | "price">;

	$: ({ title, price } = data);
</script>

<div>
	<!-- An empty 'span' element to align the row appropriately, as 'isbn' (first cell in a full, book, row) doesn't exist for custom items -->
	<span />
	<BodyMultiRow
		dlClassName="flex flex-col gap-y-0.5 mt-1 font-light text-gray-500 lg:hidden"
		rows={{
			title: { data: title },
			price: { data: price?.toFixed(2) }
		}}
	/>
</div>
