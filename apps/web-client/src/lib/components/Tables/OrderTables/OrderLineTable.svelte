<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import { type BookEntry, type NavEntry } from "@librocco/db";

	import type { createTable } from "$lib/actions";

	import { HeadCol } from "../Cells";

	import BookHeadCell from "../InventoryTables/BookHeadCell.svelte";
	import BodyMultiRow from "../Cells/BodyMultiRow.svelte";

	import type { CustomerOrderLine } from "$lib/db/orders/types";

	export let table: ReturnType<typeof createTable<CustomerOrderLine & BookEntry>>;
	import { BookQuantityFormCell } from "$lib/components/Tables";
	import { createEditQuantityEvent, type EditQuantityEvent } from "../InventoryTables/events";
	import type { EventDispatcher } from "svelte";

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;

	const dispatch = createEventDispatcher<EditQuantityEvent>();

	let editQuantity = (event: SubmitEvent, row: CustomerOrderLine) => {
		dispatch("edit-order-line-quantity", { event, row });
	};
</script>

<table id="inventory-table" class="table table-auto" use:tableAction={{ rowCount }}>
	<thead>
		<tr>
			<th scope="col">
				<span class="hidden lg:inline">ISBN</span>
				<span class="inline lg:hidden">Book</span>
			</th>
			<th scope="col" class="show-col-lg"> Title </th>
			<th scope="col" class="show-col-lg"> Status </th>

			<th scope="col" class="show-col-lg"> Authors </th>
			<th scope="col" class="table-cell-fit"> Price </th>
			<th scope="col" class="table-cell-fit"> Quantity </th>
			<th scope="col" class="show-col-md"> Publisher </th>
			<th scope="col" class="show-col-lg table-cell-fit"> Year </th>
			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{@const { rowIx, isbn, quantity, title, publisher, year, authors, price, collected, placed, received, created } = row}

			{@const coreRowData = {
				rowIx,
				isbn,

				quantity
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
						<span class="sr-only">Discounted price:</span>
						<!-- @TODO implement discount   -->
						<span data-property="discounted-price">€{((price ?? 0 * (100 - 0)) / 100).toFixed(2)}</span>
						<span class="sr-only">Original price:</span>
						<span class="text-gray-400 line-through" data-property="full-price">(€{(price ?? 0).toFixed(2)})</span>
						<span class="sr-only">Percentage discount:</span>
						<span class="text-gray-400" data-property="applied-discount">-{0}%</span>
					</div>
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
