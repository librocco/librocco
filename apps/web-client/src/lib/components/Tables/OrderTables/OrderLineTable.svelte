<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import { type BookData } from "@librocco/shared";

	import type { createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import BookHeadCell from "../InventoryTables/BookHeadCell.svelte";
	import BodyMultiRow from "../Cells/BodyMultiRow.svelte";

	import type { CustomerOrderLine } from "$lib/db/cr-sqlite/types";
	import LL from "@librocco/shared/i18n-svelte";

	export let table: ReturnType<typeof createTable<CustomerOrderLine & BookData>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;
</script>

<table id="inventory-table" class="table table-auto" use:tableAction={{ rowCount }}>
	<thead>
		<tr>
			<th scope="col">
				<span class="hidden lg:inline">{$LL.table_components.order_tables.order_line_table.isbn()}</span>
				<span class="inline lg:hidden">{$LL.table_components.order_tables.order_line_table.book()}</span>
			</th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.order_tables.order_line_table.title()} </th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.order_tables.order_line_table.isbn()} </th>
			<th scope="col" class="show-col-lg"> {$LL.table_components.order_tables.order_line_table.authors()} </th>
			<th scope="col" class="table-cell-fit"> {$LL.table_components.order_tables.order_line_table.price()} </th>
			<th scope="col" class="show-col-md"> {$LL.table_components.order_tables.order_line_table.publisher()} </th>
			<th scope="col" class="show-col-lg table-cell-fit"> {$LL.table_components.order_tables.order_line_table.year()} </th>
			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{@const { rowIx, isbn, title, publisher, year, authors, price, collected, placed, received, created } = row}

			{@const coreRowData = {
				rowIx,
				isbn
			}}
			<!-- Require action takes precedence over out of stock -->
			<tr use:table.tableRow={{ position: rowIx }}>
				<th scope="row" data-property="book" class="table-cell-max">
					<BookHeadCell data={{ isbn, title, authors, year }} />
					<BodyMultiRow
						dlClassName="flex flex-col gap-y-0.5 mt-1 font-light text-gray-500 lg:hidden"
						rows={{
							title: { data: row.title },
							authors: { data: "authors" },
							year: { data: "year" }
						}}
					/>
				</th>

				<td data-property="title" class="show-col-lg table-cell-max">
					{title}
				</td>
				<td data-property="title" class="show-col-lg table-cell-max">
					{(collected && "Collected") || (received && "Received") || (placed && "Placed") || (created && "Created")}
				</td>
				<td data-property="authors" class="show-col-lg table-cell-max">
					{authors}
				</td>
				<td data-property="price" class="table-cell-fit">
					<!-- Discounted price is shown only for book rows with discount other than 0 -->
					<!-- We're rendering this branch only if both the price and discount are defined - no price is handled in the other branch -->

					<div class="flex flex-col items-start gap-0.5">
						<span class="sr-only">{$LL.table_components.order_tables.order_line_table.discounted_price()}:</span>
						<!-- @TODO implement discount   -->
						<span data-property="discounted-price">€{((price ?? 0 * (100 - 0)) / 100).toFixed(2)}</span>
						<span class="sr-only">{$LL.table_components.order_tables.order_line_table.original_price()}:</span>
						<span class="text-gray-400 line-through" data-property="full-price">(€{(price ?? 0).toFixed(2)})</span>
						<span class="sr-only">{$LL.table_components.order_tables.order_line_table.percentage_discount()}:</span>
						<span class="text-gray-400" data-property="applied-discount">-{0}%</span>
					</div>
				</td>

				<td data-property="publisher" class="show-col-md table-cell-max">
					{publisher}
				</td>
				<td data-property="year" class="show-col-lg table-cell-fit">
					{year}
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
