<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import type { NavEntry } from "@librocco/db";

	import type { OutboundTableData } from "../types";

	import type { createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import BookHeadCell from "./BookHeadCell.svelte";
	import BookPriceCell from "./BookPriceCell.svelte";
	import BookQuantityFormCell from "./BookQuantityFormCell.svelte";

	import WarehouseSelect from "$lib/components/WarehouseSelect/WarehouseSelect.svelte";

	import { createOutboundTableEvents, type OutboundTableEvents } from "./events";

	export let table: ReturnType<typeof createTable<OutboundTableData>>;
	export let warehouseList: Iterable<[string, NavEntry]>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;

	const dispatch = createEventDispatcher<OutboundTableEvents>();
	const { editQuantity, editWarehouse } = createOutboundTableEvents(dispatch);
</script>

<table id="inventory-table" class="table table-auto" use:tableAction={{ rowCount }}>
	<thead>
		<tr>
			<th scope="col">
				<span class="hidden lg:inline">ISBN</span>
				<span class="inline lg:hidden">Book</span>
			</th>
			<th scope="col" class="show-col-lg"> Title </th>
			<th scope="col" class="show-col-lg"> Authors </th>
			<th scope="col" class="table-cell-fit"> Price </th>
			<th scope="col" class="table-cell-fit"> Quantity </th>
			<th scope="col" class="show-col-md"> Publisher </th>
			<th scope="col" class="show-col-lg table-cell-fit"> Year </th>
			<th scope="col">Warehouse </th>
			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{@const { rowIx, isbn, authors = "N/A", quantity, price, year = "N/A", title = "N/A", publisher = "", warehouseDiscount } = row}
			{@const { warehouseId, availableWarehouses } = row}
			{@const quantityInWarehouse = availableWarehouses?.get(warehouseId)?.quantity || 0}
			<!-- If a book is available in multiple warehouses (and no warehouse selected), we require action - bg is yellow -->
			{@const requiresAction = !warehouseId && availableWarehouses?.size > 1}
			<!-- If a book is out of stock in curren warehouse - paint the row red - this also catches books with no warehouse selected, but no stock in any warehouse -->
			{@const outOfStock = quantityInWarehouse < quantity}
			<!-- Require action takes precedence over out of stock -->
			<tr class={requiresAction ? "requires-action" : outOfStock ? "out-of-stock" : ""} use:table.tableRow={{ position: rowIx }}>
				<th scope="row" data-property="book" class="table-cell-max">
					<BookHeadCell data={{ isbn, title, authors, year }} />
				</th>

				<td data-property="title" class="show-col-lg table-cell-max">
					{title}
				</td>
				<td data-property="authors" class="show-col-lg table-cell-max">
					{authors}
				</td>
				<td data-property="price" class="table-cell-fit">
					<BookPriceCell data={{ price, warehouseDiscount }} />
				</td>
				<td data-property="quantity" class="table-cell-fit">
					<BookQuantityFormCell {rowIx} {quantity} on:submit={(event) => editQuantity(event, row)} />
				</td>
				<td data-property="publisher" class="show-col-md table-cell-max">
					{publisher}
				</td>
				<td data-property="year" class="show-col-lg table-cell-fit">
					{year}
				</td>
				<td data-property="warehouseName" class="table-cell-max">
					<WarehouseSelect {warehouseList} on:change={(event) => editWarehouse(event, row)} data={row} {rowIx} />
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
