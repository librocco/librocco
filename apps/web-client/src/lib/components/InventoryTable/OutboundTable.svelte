<script lang="ts">
	import type { createTable } from "./table";
	import type { InventoryTableData } from "./types";

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;
</script>

<table id="inventory-table" class="relative w-full divide-y divide-gray-200 bg-white xs:table-fixed" use:tableAction={{ rowCount }}>
	<thead>
		<tr class="whitespace-nowrap text-sm font-semibold leading-5 text-gray-900">
			<th scope="col" class="w-[9%] py-4 px-3 text-left xs:w-[15%] sm:w-[30%] lg:w-[22%] xl:w-[10%]">
				<span class="hidden xl:inline">ISBN</span>
				<span class="inline xl:hidden">Book</span>
			</th>
			<th scope="col" class="hidden py-4 px-3 text-left xl:table-cell"> Title </th>
			<th scope="col" class="hidden py-4 px-3 text-left xl:table-cell"> Authors </th>
			<th scope="col" class="w-[4%] py-4 px-3 text-center xs:text-left sm:w-[6%]">
				<span class="hidden xs:inline">Price</span>
				<span class="inline xs:hidden">
					<span class="sr-only">Price</span>
					€
				</span>
			</th>
			<th scope="col" class="w-[4%] py-4 px-3 text-center xs:w-[6%] xs:text-left">
				<span class="hidden md:inline">Quantity</span>
				<span class="inline md:hidden">
					<span class="sr-only">Quantity</span>
					Qty
				</span>
			</th>
			<th scope="col" class="hidden w-[10%] py-4 px-3 text-left lg:table-cell"> Publisher </th>
			<th scope="col" class="hidden w-[5%] py-4 px-3 text-left xl:table-cell"> Year </th>
			{#if $$slots["row-warehouse"]}
				<th scope="col" class="w-[9%] py-4 px-3 text-left sm:w-[15%] xl:w-[20%]">Warehouse </th>
			{/if}
			{#if $$slots["row-actions"]}
				<th scope="col" class="w-[3%] py-4 px-3 xs:w-[5%]">
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
				warehouseDiscount
			} = row}
			<tr class="whitespace-nowrap text-sm font-light text-gray-500 odd:bg-white even:bg-gray-50" use:table.tableRow={{ position: rowIx }}>
				<th scope="row" class="max-w-[5rem] truncate p-3 text-left font-medium text-gray-800 xs:max-w-full">
					<span data-property="isbn">{isbn}</span>
					<dl class="font-normal xl:hidden">
						<dt class="sr-only">Title:</dt>
						<dd class="mt-1 truncate font-light text-gray-500">{title}</dd>
						<dt class="sr-only">Authors:</dt>
						<dd class="mt-1 truncate font-light text-gray-500 xl:hidden">{authors}</dd>
						<dt class="sr-only">Year:</dt>
						<dd class="mt-1 truncate font-light text-gray-500 xl:hidden">{year}</dd>
					</dl>
				</th>
				<td data-property="title" class="hidden truncate px-3 py-4 xl:table-cell">
					{title}
				</td>
				<td data-property="authors" class="hidden truncate py-4 px-3 xl:table-cell">
					{authors}
				</td>
				<td data-property="price" class="truncate py-4 px-3 text-center xs:text-left">
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
				<td data-property="quantity" class="py-4 px-3 text-center xs:text-left">
					<slot name="row-quantity" {row} {rowIx}>
						<span class="badge badge-md badge-gray">{quantity.toString()}</span>
					</slot>
				</td>
				<td data-property="publisher" class="hidden truncate py-4 px-3 lg:table-cell">
					{publisher}
				</td>
				<td data-property="year" class="hidden py-4 px-3 text-left xl:table-cell">
					{year}
				</td>
				{#if $$slots["row-warehouse"]}
					<td class="py-4 text-center">
						<slot name="row-warehouse" {row} {rowIx} />
					</td>
				{/if}

				{#if $$slots["row-actions"]}
					<td class="py-4 text-center">
						<slot name="row-actions" {row} {rowIx} />
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>
