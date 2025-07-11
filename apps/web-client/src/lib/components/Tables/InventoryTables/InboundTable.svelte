<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import type { createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import BookHeadCell from "./BookHeadCell.svelte";
	import BookPriceCell from "./BookPriceCell.svelte";
	import BookOutPrintCell from "./BookOutPrintCell.svelte";
	import BookQuantityFormCell from "./BookQuantityFormCell.svelte";
	import LL from "@librocco/shared/i18n-svelte";
	import { createInboundTableEvents, type InboundTableEvents } from "./events";
	import type { InventoryTableData } from "../types";

	// The inbound table accepts only book variant rows
	export let table: ReturnType<typeof createTable<InventoryTableData<"book">>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;

	const dispatch = createEventDispatcher<InboundTableEvents>();
	const { editQuantity } = createInboundTableEvents(dispatch);
</script>

<table id="inventory-table" class="stock-table" use:tableAction={{ rowCount }}>
	<thead>
		<tr>
			<th scope="col">
				<span class="hidden lg:inline">{$LL.table_components.inventory_tables.inbound_table.isbn()}</span>
				<span class="inline lg:hidden">{$LL.table_components.inventory_tables.inbound_table.book()}</span>
			</th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.inventory_tables.inbound_table.title()} </th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.inventory_tables.inbound_table.authors()} </th>
			<th scope="col" class="table-cell-fit"> {$LL.table_components.inventory_tables.inbound_table.price()} </th>
			<th scope="col" class="table-cell-fit"> {$LL.table_components.inventory_tables.inbound_table.quantity()} </th>
			<th scope="col" class="show-col-md"> {$LL.table_components.inventory_tables.inbound_table.publisher()} </th>
			<th scope="col" class="show-col-lg table-cell-fit"> {$LL.table_components.inventory_tables.inbound_table.year()} </th>
			<th scope="col" class="show-col-xl"> {$LL.table_components.inventory_tables.inbound_table.edited_by()} </th>
			<th scope="col" class="show-col-xl table-cell-fit"> {$LL.table_components.inventory_tables.inbound_table.op()} </th>
			<th scope="col" class="show-col-xl table-cell-fit"> {$LL.table_components.inventory_tables.inbound_table.category()} </th>
			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as { rowIx, key, ...row } (key)}
			{@const { warehouseName, warehouseDiscount, availableWarehouses, ...rowData } = row}
			{@const {
				isbn,
				authors = "N/A",
				quantity,
				year = "N/A",
				title = "N/A",
				publisher = "",
				editedBy = "",
				category = "",
				outOfPrint = false
			} = rowData}
			<tr use:table.tableRow={{ position: rowIx }}>
				<th scope="row" class="table-cell-max">
					<BookHeadCell data={{ isbn, title, authors, year }} />
				</th>

				<td data-property="title" class="show-col-lg table-cell-max">
					{title}
				</td>
				<td data-property="authors" class="show-col-lg table-cell-max">
					{authors}
				</td>
				<td data-property="price" class="table-cell-fit">
					<BookPriceCell data={row} />
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
				<td data-property="editedBy" class="show-col-xl table-cell-max">
					{editedBy}
				</td>
				<td data-property="outOfPrint" class="show-col-xl table-cell-fit">
					<BookOutPrintCell {rowIx} {outOfPrint} />
				</td>
				<td data-property="category" class="show-col-xl table-cell-max">
					{category}
				</td>
				{#if $$slots["row-actions"]}
					<td class="table-cell-fit">
						<slot name="row-actions" row={rowData} {rowIx} />
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
