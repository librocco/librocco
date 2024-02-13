<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import type { createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import BookHeadCell from "./BookHeadCell.svelte";
	import BookPriceCell from "./BookPriceCell.svelte";
	import BookQuantityFormCell from "./BookQuantityFormCell.svelte";

	import WarehouseSelect from "$lib/components/WarehouseSelect/WarehouseSelect.svelte";

	import { createOutboundTableEvents, type OutboundTableEvents } from "./events";
	import type { InventoryTableData } from "../types";

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;

	const dispatch = createEventDispatcher<OutboundTableEvents>();
	const { editQuantity, editWarehouse } = createOutboundTableEvents(dispatch);
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
			<th scope="col" class="w-[6%] lg:w-[8%]"> Price </th>
			<th scope="col" class="w-[6%] lg:w-[8%]"> Quantity </th>
			<th scope="col" class="show-col-md w-[10%]"> Publisher </th>
			<th scope="col" class="show-col-md w-[6%]"> Year </th>
			<th scope="col" class="w-[9%] sm:w-[15%] xl:w-[20%]">Warehouse </th>
			{#if $$slots["row-actions"]}
				<th scope="col" class="w-[5%]"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{@const { rowIx, isbn, authors = "N/A", quantity, price, year = "N/A", title = "N/A", publisher = "", warehouseDiscount } = row}
			<tr use:table.tableRow={{ position: rowIx }}>
				<th scope="row" data-property="isbn">
					<BookHeadCell data={{ isbn, title, authors, year }} />
				</th>

				<td data-property="title" class="show-col-lg">
					{title}
				</td>
				<td data-property="authors" class="show-col-lg">
					{authors}
				</td>
				<td data-property="price">
					<BookPriceCell data={{ price, warehouseDiscount }} />
				</td>
				<td data-property="quantity">
					<BookQuantityFormCell {rowIx} {quantity} on:submit={(event) => editQuantity(event, row)} />
				</td>
				<td data-property="publisher" class="show-col-md">
					{publisher}
				</td>
				<td data-property="year" class="show-col-md">
					{year}
				</td>
				<td data-property="warehouse">
					<WarehouseSelect on:change={(event) => editWarehouse(event, row)} data={row} {rowIx} />
				</td>
				{#if $$slots["row-actions"]}
					<td>
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
