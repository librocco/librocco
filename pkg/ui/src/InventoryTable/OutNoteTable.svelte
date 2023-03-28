<script lang="ts">
	import type { createTable } from "./table";
	import type { OutNoteTableData, TransactionUpdateDetail, WarehouseChangeDetail } from "./types";

	import { Checkbox, Button, ButtonColor, Badge, BadgeSize } from "../";

	import TdWarehouseSelect from "./TdWarehouseSelect.svelte";

	import { quadIn } from "svelte/easing";
	import { fadeBgColor } from "../lib/transitions";
	import { thRowBaseStyles } from "./utils";
	import { createEventDispatcher } from "svelte";

	export let table: ReturnType<typeof createTable<OutNoteTableData>>;

	const { table: tableAction, tableRow, resetRowSelection } = table;
	$: ({ rows, selected } = $table);

	const isChecked = (event: Event) => (event?.target as HTMLInputElement)?.checked;

	// table rows + one header row
	$: rowCount = rows.length + 1;

	const headers = {
		isbn: "ISBN",
		title: "Title",
		authors: "Authors",
		quantity: "Quantity",
		price: "Price",
		publisher: "Publisher",
		year: "Year",
		warehouses: "Warehouse"
	};

	/** @TODO mvp quick integration */
	const dispatch = createEventDispatcher<{ transactionupdate: TransactionUpdateDetail }>();
	const handleWarehouseChange = (matchTxn: TransactionUpdateDetail["matchTxn"]) => (e: CustomEvent<WarehouseChangeDetail>) => {
		const { warehouseId } = e.detail;
		const updateTxn = { ...matchTxn, warehouseId };

		// Block identical updates (with respect to the existing state) as they might cause an feedback loop when connected to the live db.
		if (warehouseId === matchTxn.warehouseId) {
			return;
		}
		dispatch("transactionupdate", { matchTxn, updateTxn });
	};
</script>

<div class="overflow-x-auto">
	<table class="relative min-w-full divide-y divide-gray-200 bg-white" use:tableAction={{ rowCount }}>
		{#if selected.length}
			<div class="absolute left-14 top-[6px] flex items-center bg-white md:left-16 2xl:left-[4.5rem]">
				<Button color={ButtonColor.White} on:click={() => resetRowSelection()}>
					Delete {selected.length}
				</Button>
			</div>
		{/if}
		<thead>
			<tr
				class="whitespace-nowrap"
				use:tableRow={{
					position: 0,
					on: "change",
					handleSelect: (event, selected) => {
						const isSelected = isChecked(event);

						if (isSelected) {
							selected.set(rows);
						} else {
							selected.set([]);
						}
					}
				}}
			>
				<th scope="col" class="px-2 text-center">
					<span class="inline-block">
						<Checkbox name="Select all" checked={selected.length ? true : false} />
					</span>
				</th>
				<th scope="col" class={thRowBaseStyles}>
					<span class="hidden lg:inline">{headers.isbn}</span>
					<span class="inline lg:hidden">book</span>
				</th>
				<th scope="col" class="{thRowBaseStyles} hidden lg:table-cell">
					{headers.title}
				</th>
				<th scope="col" class="{thRowBaseStyles} hidden lg:table-cell">
					{headers.authors}
				</th>
				<th scope="col" class={thRowBaseStyles}>
					<span class="hidden lg:inline">{headers.quantity}</span>
					<span class="inline lg:hidden">qty</span>
				</th>
				<th scope="col" class="{thRowBaseStyles} hidden sm:table-cell">
					{headers.price}
				</th>
				<th scope="col" class="{thRowBaseStyles} hidden md:table-cell">
					{headers.year}
				</th>

				<th scope="col" class={thRowBaseStyles}> {headers.warehouses} </th>
			</tr>
		</thead>

		<tbody>
			{#each rows as row (row.key)}
				{@const { isbn, title, authors, year, quantity, price, rowIx, warehouseId } = row}
				<tr
					use:tableRow={{
						// Header row starts the count at 0
						position: rowIx + 1,
						on: "change",
						handleSelect: (event, selected) => {
							const isSelected = isChecked(event);

							if (isSelected) {
								selected.update((rows) => [...rows, row]);
							} else {
								selected.update((rows) => rows.filter((r) => r.key !== row.key));
							}
						}
					}}
					class={`whitespace-nowrap text-sm font-light text-gray-500 ${
						selected.includes(row) ? "bg-gray-100" : "even:bg-gray-50"
					}`}
				>
					<td
						class={`px-2 text-center sm:align-middle border-l-4 
                        ${selected.includes(row) ? "border-teal-500" : "border-transparent"}
                    `}
					>
						<span class="inline-block">
							<Checkbox name={`Select ${title}`} checked={selected.includes(row)} />
						</span>
					</td>
					<th scope="row" class="py-4 px-3 text-left font-medium text-gray-800 lg:w-auto lg:max-w-none">
						{isbn}
						<dl class="font-normal lg:hidden">
							<dt class="sr-only">Title:</dt>
							<dd class="mt-1 truncate font-light text-gray-500">{title}</dd>
							<dt class="sr-only">Authors:</dt>
							<dd class="mt-1 truncate font-light text-gray-500 lg:hidden">{authors}</dd>
							<dt class="sr-only">Price:</dt>
							<dd class="mt-1 truncate font-light text-gray-500 sm:hidden">€{price}</dd>
						</dl>
					</th>
					<td class="hidden px-3 py-4 lg:table-cell">
						{title}
					</td>
					<td class="hidden py-4 px-3 lg:table-cell">
						{authors}
					</td>
					<td class="py-4 px-3 text-left">
						<Badge label={`${quantity}`} size={BadgeSize.LG} />
					</td>
					<td class="hidden py-4 px-3 text-left sm:table-cell">
						{price}
					</td>
					<td class="hidden py-4 px-3 text-left md:table-cell">
						{year}
					</td>

					<TdWarehouseSelect on:change={handleWarehouseChange({ isbn, warehouseId, quantity })} data={row} {rowIx} />
				</tr>
			{/each}
		</tbody>
	</table>
</div>
