<script lang="ts">
	import { type createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import type { InventoryTableData } from "../types";
	import BookRow from "./BookRow.svelte";

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
			{@const { rowIx, key, ...rowData } = row}

			<slot name="row" row={rowData} {rowIx}>
				<tr use:table.tableRow={{ position: rowIx }}>
					<BookRow row={rowData} {rowIx} />
				</tr>
			</slot>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
