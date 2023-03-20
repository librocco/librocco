<script lang="ts">
	import type { createTable } from './table';
	import type { InventoryTableData } from './types';

	import { Checkbox, Button, ButtonColor, Badge, BadgeSize } from '../';

	import { quadIn } from 'svelte/easing';
	import { fadeBgColor } from '../lib/transitions';
	import { thRowBaseStyles } from './utils';

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

	const { removeRows, table: tableAction, tableRow } = table;
	$: ({ rows, selected } = $table);

	const isChecked = (event: Event) => (event?.target as HTMLInputElement)?.checked;

	// table rows + one header row
	$: rowCount = rows.length + 1;

	const headers = {
		isbn: 'ISBN',
		title: 'Title',
		authors: 'Authors',
		quantity: 'Quantity',
		price: 'Price',
		publisher: 'Publisher',
		year: 'Year',
		editedBy: 'Edited By',
		outOfPrint: 'Out of Print'
	};
</script>

<div class="overflow-x-auto">
	<table class="relative min-w-full divide-y divide-gray-200 bg-white" use:tableAction={{ rowCount }}>
		{#if selected.length}
			<div class="absolute left-14 top-[6px] flex items-center bg-white md:left-16 2xl:left-[4.5rem]">
				<Button color={ButtonColor.White} on:click={() => removeRows(selected)}>
					Delete {selected.length}
				</Button>
			</div>
		{/if}
		<thead>
			<tr
				class="whitespace-nowrap"
				use:tableRow={{
					position: 0,
					on: 'change',
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
				<th scope="col" class="{thRowBaseStyles} hidden xl:table-cell">
					{headers.outOfPrint}
				</th>
			</tr>
		</thead>

		<tbody>
			{#each rows as row (row.key)}
				{@const { rowIx, isbn, authors, quantity, price, year, title, publisher, editedBy, outOfPrint } = row}
				<tr
					in:fadeBgColor={{ duration: 200, easing: quadIn, color: 'rgb(220 252 231)' }}
					out:fadeBgColor={{ duration: 150, easing: quadIn, color: 'rgb(254 226 226)' }}
					use:tableRow={{
						// Header row starts the count at 0
						position: rowIx + 1,
						on: 'change',
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
						selected.includes(row) ? 'bg-gray-100' : 'even:bg-gray-50'
					}`}
				>
					<td
						class={`px-2 text-center sm:align-middle border-l-4 
						${selected.includes(row) ? 'border-teal-500' : 'border-transparent'}
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
							<dt class="sr-only">Year:</dt>
							<dd class="mt-1 truncate font-light text-gray-500 sm:hidden">{year}</dd>
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
					<td class="py-4 px-3 text-left">
						{price}
					</td>
					<td class="hidden py-4 px-3 text-left sm:table-cell">
						{year}
					</td>

					<td class="hidden py-4 px-3 md:table-cell">
						{publisher}
					</td>
					<td class="hidden py-4 px-3 xl:table-cell">
						{editedBy}
					</td>
					<td class="hidden py-4 px-3 text-center xl:table-cell">
						<span class="inline-block">
							<Checkbox
								name={`Row ${rowIx} is out of print: ${outOfPrint}`}
								checked={outOfPrint}
								disabled
							/>
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
