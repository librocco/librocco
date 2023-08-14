<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import type { createTable } from "./table";
	import type { InventoryTableData, RemoveTransactionsDetail, TransactionUpdateDetail } from "./types";

	import { Checkbox, Button, ButtonColor, BadgeSize, type BookEntry } from "../";
	import QuantityInput from "./QuantityInput.svelte";
	import Badge from "../Badge/Badge.svelte";

	import { thRowBaseStyles } from "./utils";

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

	export let interactive = false;

	export let onEdit: (bookEntry: BookEntry) => void = () => {};

	const { resetRowSelection, table: tableAction, tableRow } = table;
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
		editedBy: "Edited By",
		outOfPrint: "Out of Print",
		edit: "Edit"
	};

	/** @TODO mvp quick integration */
	interface EventMap {
		transactionupdate: TransactionUpdateDetail;
		removetransactions: RemoveTransactionsDetail;
		edit: RemoveTransactionsDetail;
	}
	const dispatch = createEventDispatcher<EventMap>();
	const handleQuantityChange = (matchTxn: TransactionUpdateDetail["matchTxn"]) => (e: CustomEvent<number>) => {
		const quantity = e.detail;
		const updateTxn = { ...matchTxn, quantity };

		// Block identical updates (with respect to the existing state) as they might cause an feedback loop when connected to the live db.
		if (quantity === matchTxn.quantity) {
			return;
		}
		dispatch("transactionupdate", { matchTxn, updateTxn });
	};

	$: handleRemoveTransactions = () => {
		const transactions = selected.map(({ isbn, warehouseId }) => ({ isbn, warehouseId }));
		dispatch("removetransactions", transactions);
		resetRowSelection();
	};
</script>

<table id="inventory-table" class="relative min-w-full divide-y divide-gray-200 bg-white" use:tableAction={{ rowCount }}>
	{#if selected.length}
		<div class="absolute left-14 top-[6px] flex items-center bg-white md:left-16 2xl:left-[4.5rem]">
			<Button color={ButtonColor.White} on:click={handleRemoveTransactions}>Delete {selected.length}</Button>
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
			<!-- Show checkbox/row selection only on interactive variant -->
			{#if interactive}
				<th scope="col" class="px-2 text-center">
					<span class="inline-block">
						<Checkbox name="Select all" checked={selected.length ? true : false} />
					</span>
				</th>
			{/if}

			<th scope="col" class="{thRowBaseStyles} {interactive ? '' : 'pl-8'}">
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
			<th scope="col" class={thRowBaseStyles}>
				{headers.price}
			</th>
			<th scope="col" class="{thRowBaseStyles} hidden sm:table-cell">
				{headers.year}
			</th>
			<th scope="col" class="{thRowBaseStyles} hidden md:table-cell">
				{headers.publisher}
			</th>
			<th scope="col" class="{thRowBaseStyles} hidden xl:table-cell">
				{headers.editedBy}
			</th>
			<th scope="col" class="{thRowBaseStyles} hidden lg:table-cell">
				{headers.edit}
			</th>
			<th scope="col" class="{thRowBaseStyles} hidden xl:table-cell">
				{headers.outOfPrint}
			</th>
		</tr>
	</thead>

	<tbody>
		{#each rows as row (row.key)}
			{@const {
				rowIx,
				isbn,
				warehouseId,
				authors = "N/A",
				quantity,
				price = "N/A",
				year = "N/A",
				title = "N/A",
				publisher = "",
				editedBy = "",
				outOfPrint = false
			} = row}
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
				class={`whitespace-nowrap text-sm font-light text-gray-500 ${selected.includes(row) ? "bg-gray-100" : "even:bg-gray-50"}`}
			>
				<!-- Show chackbox/row selection only on interactive variant -->
				{#if interactive}
					<td class="border-l-4 px-2 text-center sm:align-middle {selected.includes(row) ? 'border-teal-500' : 'border-transparent'}">
						<span class="inline-block">
							<Checkbox name={`Select ${title}`} checked={selected.includes(row)} />
						</span>
					</td>
				{/if}

				<th scope="row" class="p-3 text-left font-medium text-gray-800 lg:w-auto lg:max-w-none {interactive ? '' : 'pl-8'}">
					<span data-property="isbn">{isbn}</span>
					<dl class="max-w-[15rem] truncate font-normal lg:hidden">
						<dt class="sr-only">Title:</dt>
						<dd class="mt-1 truncate font-light text-gray-500">{title}</dd>
						<dt class="sr-only">Authors:</dt>
						<dd class="mt-1 truncate font-light text-gray-500 lg:hidden">{authors}</dd>
						<dt class="sr-only">Year:</dt>
						<dd class="mt-1 truncate font-light text-gray-500 sm:hidden">{year}</dd>
					</dl>
				</th>
				<td data-property="title" class="hidden px-3 py-4 lg:table-cell">
					<span class="inline-block max-w-[15rem] truncate">{title}</span>
				</td>
				<td data-property="authors" class="hidden py-4 px-3 lg:table-cell">
					{authors}
				</td>
				<td data-property="quantity" class="py-4 px-3 text-left">
					{#if interactive}
						<!-- For interactive variant, show the quantity input element -->
						<QuantityInput value={quantity} on:submit={handleQuantityChange({ isbn, quantity, warehouseId })} />
					{:else}
						<!-- For non interactive variant, show only the (non-interative) badge element -->
						<Badge label={quantity.toString()} size={BadgeSize.LG} />
					{/if}
				</td>
				<td data-property="price" class="py-4 px-3 text-left">
					{price}
				</td>
				<td data-property="year" class="hidden py-4 px-3 text-left sm:table-cell">
					{year}
				</td>

				<td data-property="publisher" class="hidden py-4 px-3 md:table-cell">
					{publisher}
				</td>
				<td data-property="editedBy" class="hidden py-4 px-3 xl:table-cell">
					{editedBy}
				</td>
				<td class="py-4 px-3 text-left">
					<div class="flex items-center bg-white md:left-16 2xl:left-[4.5rem]">
						<Button color={ButtonColor.White} on:click={() => onEdit(row)}>Edit</Button>
					</div>
				</td>
				<td data-property="outOfPrint" class="hidden py-4 px-3 text-center xl:table-cell">
					<span class="inline-block">
						<Checkbox name={`Row ${rowIx} is out of print: ${outOfPrint}`} checked={outOfPrint} disabled />
					</span>
				</td>
			</tr>
		{/each}
	</tbody>
</table>
