<script lang="ts">
	import { type createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";
	import LL from "@librocco/shared/i18n-svelte";
	import type { InventoryTableData } from "../types";
	import StockBookRow from "./StockBookRow.svelte";

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;
</script>

<table id="inventory-table" class="stock-table" use:tableAction={{ rowCount }}>
	<thead>
		<tr>
			<th scope="col" class="w-[20%] lg:w-[13%] xl:w-[10%]">
				<span class="hidden lg:inline">{$LL.table_components.inventory_tables.stock_table.isbn()}</span>
				<span class="inline lg:hidden">{$LL.table_components.inventory_tables.stock_table.book()}</span>
			</th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.inventory_tables.stock_table.title()} </th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.inventory_tables.stock_table.authors()} </th>
			<th scope="col"> {$LL.table_components.inventory_tables.stock_table.price()} </th>
			<th scope="col"> {$LL.table_components.inventory_tables.stock_table.quantity()} </th>
			<th scope="col"> {$LL.table_components.inventory_tables.stock_table.publisher()} </th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.inventory_tables.stock_table.year()} </th>
			<th scope="col" class="show-col-xl"> {$LL.table_components.inventory_tables.stock_table.edited_by()} </th>
			<th scope="col" class="show-col-xl"> {$LL.table_components.inventory_tables.stock_table.op()} </th>
			<th scope="col" class="show-col-xl"> {$LL.table_components.inventory_tables.stock_table.category()} </th>
			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{@const { rowIx, key, ...rowData } = row}

			<slot name="row" row={rowData} {rowIx}>
				<tr use:table.tableRow={{ position: rowIx }}>
					<StockBookRow row={rowData} {rowIx} />
				</tr>
			</slot>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
