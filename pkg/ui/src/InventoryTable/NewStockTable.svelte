<script lang="ts">
	import type { createTable } from "./table";
	import type { InventoryTableData } from "./types";

	import { Checkbox, BadgeSize } from "..";
	import Badge from "../Badge/Badge.svelte";

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;
</script>

<table id="inventory-table" class="relative w-full table-fixed divide-y divide-gray-200 bg-white" use:tableAction={{ rowCount }}>
	<thead>
		<tr class="whitespace-nowrap text-sm font-semibold leading-5 text-gray-900">
			<th scope="col" class="w-[22%] py-4 px-3 text-left sm:w-[30%] lg:w-[13%] xl:w-[10%]">
				<span class="hidden lg:inline">ISBN</span>
				<span class="inline lg:hidden">Book</span>
			</th>
			<th scope="col" class="hidden py-4 px-3 text-left lg:table-cell"> Title </th>
			<th scope="col" class="hidden py-4 px-3 text-left lg:table-cell"> Authors </th>
			<th scope="col" class="xs:text-left w-[6%] py-4 px-3 text-center lg:w-[8%]">
				<span class="xs:inline hidden">Quantity</span>
				<span class="xs:hidden inline">
					<span class="sr-only">Quantity</span>
					#
				</span>
			</th>
			<th scope="col" class="xs:text-left w-[6%] py-4 px-3 text-center lg:w-[8%]">
				<span class="xs:inline hidden">Price</span>
				<span class="xs:hidden inline">
					<span class="sr-only">Price</span>
					€
				</span>
			</th>
			<th scope="col" class="hidden w-[10%] py-4 px-3 text-left md:table-cell"> Publisher </th>
			<th scope="col" class="hidden w-[5%] py-4 px-3 text-left sm:table-cell"> Year </th>
			<th scope="col" class="hidden w-[10%] py-4 px-3 text-left xl:table-cell"> Edited By </th>
			<th scope="col" class="hidden w-[4%] py-4 px-3 text-left xl:table-cell"> O.P </th>
			{#if $$slots["row-actions"]}
				<th scope="col" class="w-[5%] py-4 px-3">
					<span class="sr-only">Row Actions</span>
				</th>
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
				price = "N/A",
				year = "N/A",
				title = "N/A",
				publisher = "",
				editedBy = "",
				outOfPrint = false,
				warehouseDiscount
			} = row}
			{@const stringQty = quantity.toString()}

			<tr class="whitespace-nowrap text-sm font-light text-gray-500 odd:bg-white even:bg-gray-50">
				<th scope="row" class="truncate p-3 text-left font-medium text-gray-800 ">
					<span data-property="isbn">{isbn}</span>
					<dl class="font-normal lg:hidden">
						<dt class="sr-only">Title:</dt>
						<dd class="mt-1 truncate font-light text-gray-500">{title}</dd>
						<dt class="sr-only">Authors:</dt>
						<dd class="mt-1 truncate font-light text-gray-500 lg:hidden">{authors}</dd>
						<dt class="sr-only">Year:</dt>
						<dd class="mt-1 truncate font-light text-gray-500 sm:hidden">{year}</dd>
					</dl>
				</th>
				<td data-property="title" class="hidden truncate px-3 py-4 lg:table-cell">
					{title}
				</td>
				<td data-property="authors" class="hidden truncate py-4 px-3 lg:table-cell">
					{authors}
				</td>
				<td data-property="quantity" class="xs:text-left py-4 px-3 text-center">
					<slot name="row-quantity" quantity={stringQty}>
						<Badge label={stringQty} size={BadgeSize.LG} />
					</slot>
				</td>
				<td data-property="price" class="xs:text-left truncate py-4 px-3 text-center">
					{#if price !== "N/A" && warehouseDiscount}
						<div class="flex flex-col items-start gap-1">
							<span class="sr-only">Discounted price:</span>
							<span>{price - warehouseDiscount / 100}</span>
							<span class="sr-only">Original price:</span>
							<span class="text-gray-400 line-through">({price})</span>
						</div>
					{:else}
						{price}
					{/if}
				</td>
				<td data-property="publisher" class="hidden truncate py-4 px-3 md:table-cell">
					{publisher}
				</td>
				<td data-property="year" class="hidden py-4 px-3 text-left sm:table-cell">
					{year}
				</td>
				<td data-property="editedBy" class="hidden truncate py-4 px-3 xl:table-cell">
					{editedBy}
				</td>
				<td data-property="outOfPrint" class="hidden py-4 px-3 text-left xl:table-cell">
					<span class="inline-block">
						<Checkbox name="Row ${rowIx} is out of print: ${outOfPrint}" checked={outOfPrint} disabled />
					</span>
				</td>
				{#if $$slots["row-actions"]}
					<td class="py-4 text-center">
						<slot name="row-actions" {row} {rowIx} />
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>
