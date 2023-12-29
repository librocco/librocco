<script lang="ts">
	import {
		Checkbox,
		Button,
		ButtonColor,
		TdWarehouseSelect,
		type BookEntry,
		type OutNoteTableData,
		type WarehouseChangeDetail,
		type TransactionUpdateDetail,
		type RemoveTransactionsDetail,
		createTable
	} from "$lib/components";

	import QuantityInput from "./QuantityInput.svelte";

	import { thRowBaseStyles } from "./utils";
	import { createEventDispatcher } from "svelte";

	export let table: ReturnType<typeof createTable<OutNoteTableData>>;
	export let onEdit: (bookEntry: BookEntry) => void = () => {};

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
		warehouses: "Warehouse",
		edit: "Edit"
	};

	/** @TODO mvp quick integration */
	interface EventMap {
		transactionupdate: TransactionUpdateDetail;
		removetransactions: RemoveTransactionsDetail;
	}
	const dispatch = createEventDispatcher<EventMap>();
	const handleWarehouseChange = (matchTxn: TransactionUpdateDetail["matchTxn"]) => (e: CustomEvent<WarehouseChangeDetail>) => {
		const { warehouseId } = e.detail;
		const updateTxn = { ...matchTxn, warehouseId };

		// Block identical updates (with respect to the existing state) as they might cause an feedback loop when connected to the live db.
		if (warehouseId === matchTxn.warehouseId) {
			return;
		}
		dispatch("transactionupdate", { matchTxn, updateTxn });
	};

	const handleQuantityChange = (matchTxn: TransactionUpdateDetail["matchTxn"]) => (e: SubmitEvent) => {
		const data = new FormData(e.currentTarget as HTMLFormElement);
		const quantity = Number(data.get("quantity"));

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
			<Button color={ButtonColor.White} on:click={handleRemoveTransactions}>
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
			<th scope="col" class="{thRowBaseStyles} hidden md:table-cell">
				{headers.edit}
			</th>

			<th scope="col" class={thRowBaseStyles}> {headers.warehouses} </th>
		</tr>
	</thead>

	<tbody>
		{#each rows as row (row.key)}
			{@const { isbn, title = "N/A", authors = "N/A", year = "N/A", quantity, price = "N/A", rowIx, warehouseId } = row}
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
				<td
					class={`border-l-4 px-2 text-center sm:align-middle 
                        ${selected.includes(row) ? "border-teal-500" : "border-transparent"}
                    `}
				>
					<span class="inline-block">
						<Checkbox name={`Select ${title}`} checked={selected.includes(row)} />
					</span>
				</td>
				<th scope="row" class="py-4 px-3 text-left font-medium text-gray-800 lg:w-auto lg:max-w-none">
					<span data-property="isbn">
						{isbn}
					</span>
					<dl class="font-normal lg:hidden">
						<dt class="sr-only">Title:</dt>
						<dd class="mt-1 truncate font-light text-gray-500">{title}</dd>
						<dt class="sr-only">Authors:</dt>
						<dd class="mt-1 truncate font-light text-gray-500 lg:hidden">{authors}</dd>
						<dt class="sr-only">Price:</dt>
						<dd class="mt-1 truncate font-light text-gray-500 sm:hidden">€{price}</dd>
					</dl>
				</th>
				<td data-property="title" class="hidden px-3 py-4 lg:table-cell">
					{title}
				</td>
				<td data-property="authors" class="hidden py-4 px-3 lg:table-cell">
					{authors}
				</td>
				<td data-property="quantity" class="py-4 px-3 text-left">
					<form method="POST" id="row-quantity-form" on:submit|preventDefault={handleQuantityChange({ isbn, warehouseId, quantity })}>
						<QuantityInput value={quantity} name="quantity" id="quantity" min="1" required />
					</form>
				</td>
				<td data-property="price" class="hidden py-4 px-3 text-left sm:table-cell">
					{price}
				</td>
				<td data-property="year" class="hidden py-4 px-3 text-left md:table-cell">
					{year}
				</td>
				<td class="hidden py-4 px-3 text-left md:table-cell">
					<div class="flex items-center bg-white md:left-16 2xl:left-[4.5rem]">
						<Button color={ButtonColor.White} on:click={() => onEdit(row)}>Edit</Button>
					</div>
				</td>

				<TdWarehouseSelect on:change={handleWarehouseChange({ isbn, warehouseId, quantity })} data={row} {rowIx} />
			</tr>
		{/each}
	</tbody>
</table>
