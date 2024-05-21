<script lang="ts">
	import BookHeadCell from "./BookHeadCell.svelte";
	import BookPriceCell from "./BookPriceCell.svelte";
	import BookOutPrintCell from "./BookOutPrintCell.svelte";

	import type { InventoryTableData } from "../types";

	export let row: InventoryTableData;
	export let rowIx: number;

	const {
		isbn,
		authors = "N/A",
		quantity,
		price,
		year = "N/A",
		title = "N/A",
		publisher = "",
		editedBy = "",
		outOfPrint = false,
		warehouseDiscount,
		category = ""
	} = row;
</script>

<th scope="row" class="table-cell-max">
	<BookHeadCell data={{ isbn, title, authors, year }} />
</th>

<td data-property="title" class="show-col-lg table-cell-max">
	{title}
</td>
<td data-property="authors" class="show-col-lg table-cell-max">
	{authors}
</td>
<td data-property="price" class="">
	<BookPriceCell data={{ price, warehouseDiscount }} />
</td>
<td data-property="quantity" class="">
	<span class="badge badge-md badge-gray">
		{quantity}
	</span>
</td>
<td data-property="publisher" class="show-col-sm table-cell-max">
	{publisher}
</td>
<td data-property="year" class="show-col-lg">
	{year}
</td>
<td data-property="editedBy" class="show-col-xl table-cell-max">
	{editedBy}
</td>
<td data-property="outOfPrint" class="show-col-xl">
	<BookOutPrintCell {rowIx} {outOfPrint} />
</td>
<td data-property="category" class="show-col-xl table-cell-max">
	{category}
</td>
{#if $$slots["row-actions"]}
	<td class="table-cell-fit">
		<slot name="row-actions" {row} {rowIx} />
	</td>
{/if}
