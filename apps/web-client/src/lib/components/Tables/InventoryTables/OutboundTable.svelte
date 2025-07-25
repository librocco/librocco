<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import type { InventoryTableData } from "../types";

	import type { createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import BookHeadCell from "./BookHeadCell.svelte";
	import BookPriceCell from "./BookPriceCell.svelte";
	import BookQuantityFormCell from "./BookQuantityFormCell.svelte";
	import CustomItemHeadCell from "./CustomItemHeadCell.svelte";

	import LL from "@librocco/shared/i18n-svelte";
	import { createOutboundTableEvents, type OutboundTableEvents } from "./events";

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;

	const dispatch = createEventDispatcher<OutboundTableEvents>();
	const { editQuantity, editWarehouse } = createOutboundTableEvents(dispatch);

	// TODO: this is a duplicate
	const isBookRow = (data: InventoryTableData): data is InventoryTableData<"book"> => data.__kind !== "custom";
</script>

<table id="inventory-table" class="stock-table table-auto" use:tableAction={{ rowCount }}>
	<thead>
		<tr>
			<th scope="col">
				<span class="hidden lg:inline">{$LL.table_components.inventory_tables.outbound_table.isbn()}</span>
				<span class="inline lg:hidden">{$LL.table_components.inventory_tables.outbound_table.book()}</span>
			</th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.inventory_tables.outbound_table.title()} </th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.inventory_tables.outbound_table.authors()} </th>
			<th scope="col" class="table-cell-fit"> {$LL.table_components.inventory_tables.outbound_table.price()} </th>
			<th scope="col" class="table-cell-fit"> {$LL.table_components.inventory_tables.outbound_table.quantity()} </th>
			<th scope="col" class="show-col-md"> {$LL.table_components.inventory_tables.outbound_table.publisher()} </th>
			<th scope="col" class="show-col-lg table-cell-fit">
				{$LL.table_components.inventory_tables.outbound_table.year()}
			</th>
			<th scope="col">{$LL.table_components.inventory_tables.outbound_table.warehouse()} </th>
			<th scope="col" class="show-col-md"> {$LL.table_components.inventory_tables.outbound_table.category()} </th>

			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit">
					<HeadCol label={$LL.table_components.inventory_tables.outbound_table.row_actions()} srOnly />
				</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{#if isBookRow(row)}
				{@const { rowIx, isbn, authors = "N/A", quantity, year = "N/A", title = "N/A", publisher = "", category = "" } = row}
				{@const { warehouseId, warehouseName, availableWarehouses } = row}
				<!-- If no warehouse is selected - paint the row red -->
				{@const noWarehouse = !warehouseId || warehouseName === "not-found"}
				<!-- This back and forth is necessary for TS + Svelte to recognise the object as book variant (not custom item) -->
				<tr class={noWarehouse ? "out-of-stock" : ""} use:table.tableRow={{ position: rowIx }}>
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
					<td data-property="warehouseName" class="table-cell-max">
						{#if $$slots["warehouse-select"]}
							<slot {editWarehouse} {row} {rowIx} name="warehouse-select"></slot>
						{/if}
					</td>
					<td data-property="category" class="show-col-md table-cell-max">
						{category}
					</td>

					{#if $$slots["row-actions"]}
						<td class="table-cell-fit">
							<slot name="row-actions" {row} {rowIx} />
						</td>
					{/if}
				</tr>
			{:else}
				{@const { rowIx, title, price } = row}
				<tr use:table.tableRow={{ position: rowIx }}>
					<th scope="row" id="custom-item" data-property="custom-item" class="table-cell-max">
						<CustomItemHeadCell data={{ title, price }} />
					</th>

					<td data-property="title" class="show-col-lg table-cell-max">
						{title}
					</td>
					<td class="show-col-lg"></td>
					<td data-property="price" class="table-cell-fit">
						<BookPriceCell data={row} />
					</td>
					<td class="table-cell-fit"></td>
					<td class="show-col-md"></td>
					<td class="show-col-lg table-cell-fit"></td>
					<td></td>
					<td class="show-col-md"></td>
					{#if $$slots["row-actions"]}
						<td class="table-cell-fit">
							<slot name="row-actions" {row} {rowIx} />
						</td>
					{/if}
				</tr>
			{/if}
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";

	@media print {
		#custom-item {
			display: none;
		}
	}
</style>
