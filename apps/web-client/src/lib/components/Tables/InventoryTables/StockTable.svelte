<script lang="ts">
	import type { createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import BookHeadCell from "./BookHeadCell.svelte";
	import BookPriceCell from "./BookPriceCell.svelte";
	import BookOutPrintCell from "./BookOutPrintCell.svelte";

	import type { InventoryTableData } from "../types";

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;
</script>

<table id="inventory-table" class="table" use:tableAction={{ rowCount }}>
	<thead>
		<tr>
			<th scope="col" class="w-[20%] lg:w-[13%] xl:w-[10%]">
				<span class="hidden lg:inline">ISBN</span>
				<span class="inline lg:hidden">Book</span>
			</th>
			<th scope="col" class="show-col-lg"> Title </th>
			<th scope="col" class="show-col-lg"> Authors </th>
			<th scope="col"> Price </th>
			<th scope="col"> Quantity </th>
			<th scope="col"> Publisher </th>
			<th scope="col" class="show-col-lg"> Year </th>
			<th scope="col" class="show-col-xl "> Edited By </th>
			<th scope="col" class="show-col-xl"> O.P </th>
			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{@const {
				rowIx,
				isbn,
				authors = "N/A",
				quantity,
				price,
				year = "N/A",
				title = "N/A",
				publisher = "",
				editedBy = "",
				outOfPrint = false,
				warehouseDiscount
			} = row}
			<tr use:table.tableRow={{ position: rowIx }}>
				<th scope="row" data-property="isbn" class="table-cell-max">
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
				{#if $$slots["row-actions"]}
					<td class="table-cell-fit">
						<slot name="row-actions" {row} {rowIx} />
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
