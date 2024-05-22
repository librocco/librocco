<script lang="ts">
	import { isBookRow } from "@librocco/db";

	import type { InventoryTableData } from "../types";

	import BookHeadCell from "./BookHeadCell.svelte";
	import BookPriceCell from "./BookPriceCell.svelte";
	import BookOutPrintCell from "./BookOutPrintCell.svelte";
	import CustomItemHeadCell from "./CustomItemHeadCell.svelte";

	export let row: InventoryTableData;
	export let rowIx: number;
</script>

{#if isBookRow(row)}
	{@const isbn = row.isbn}
	{@const authors = row.authors || "N/A"}
	{@const quantity = row.quantity}
	{@const price = row.price}
	{@const year = row.year || "N/A"}
	{@const title = row.title || "N/A"}
	{@const publisher = row.publisher || ""}
	{@const editedBy = row.editedBy || ""}
	{@const outOfPrint = row.outOfPrint || false}
	{@const warehouseDiscount = row.warehouseDiscount}

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
		<BookPriceCell data={row} />
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

	{#if $$slots["row-actions"]}
		<td class="table-cell-fit">
			<slot name="row-actions" {row} {rowIx} />
		</td>
	{/if}
{:else}
	{@const { title, price } = row}
	<th scope="row" data-property="custom-item" class="table-cell-max">
		<CustomItemHeadCell data={{ title, price }} />
	</th>

	<td data-property="title" class="show-col-lg table-cell-max">
		{title}
	</td>
	<td />
	<td data-property="price" class="table-cell-fit">
		<BookPriceCell data={row} />
	</td>
	<td />
	<td />
	<td />
	<td />

	{#if $$slots["row-actions"]}
		<td class="table-cell-fit">
			<slot name="row-actions" {row} {rowIx} />
		</td>
	{/if}
{/if}
