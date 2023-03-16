<script lang="ts">
	import { quadIn } from 'svelte/easing';

	import type { createTable } from './table';
	import type { InventoryTableData } from './types';
	import { InventoryTableVariant } from './enums';

	import { fadeBgColor } from '../lib/transitions';
	import { Checkbox, Button, ButtonColor } from '../';

	import { CoreBookTableData, OptionalBookTableData, OutNoteTableData } from './TableData';

	export let table: ReturnType<typeof createTable<InventoryTableData>>;
	export let variant: InventoryTableVariant = InventoryTableVariant.Default;

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
		outOfPrint: 'Out of Print',
		warehouses: 'Warehouse'
	};

	const headerStyles =
		'whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500';
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
				<th scope="col" class={headerStyles}>
					<span class="hidden lg:inline">{headers.isbn}</span>
					<span class="inline lg:hidden">book</span>
				</th>
				<th scope="col" class="{headerStyles} hidden lg:table-cell">
					{headers.title}
				</th>
				<th scope="col" class="{headerStyles} hidden lg:table-cell">
					{headers.authors}
				</th>
				<th scope="col" class={headerStyles}>
					<span class="hidden lg:inline">{headers.quantity}</span>
					<span class="inline lg:hidden">qty</span>
				</th>
				<th scope="col" class={headerStyles}>
					{headers.price}
				</th>
				<th scope="col" class="{headerStyles} hidden sm:table-cell">
					{headers.year}
				</th>
				{#if variant === InventoryTableVariant.Default}
					<th scope="col" class="{headerStyles} hidden md:table-cell">
						{headers.publisher}
					</th>
					<th scope="col" class="{headerStyles} hidden xl:table-cell">
						{headers.editedBy}
					</th>
					<th scope="col" class="{headerStyles} hidden xl:table-cell">
						{headers.outOfPrint}
					</th>
				{:else}
					<th scope="col" class={headerStyles}> {headers.warehouses} </th>
				{/if}
			</tr>
		</thead>

		<tbody>
			{#each rows as row (row.key)}
				{@const { rowIx, title, publisher, editedBy, outOfPrint, warehouses, ...core } = row}

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

					<CoreBookTableData data={{ title, ...core }} />

					{#if variant === InventoryTableVariant.Default}
						<OptionalBookTableData data={{ publisher, editedBy, outOfPrint }} {rowIx} />
					{:else}
						<OutNoteTableData data={{ warehouses }} {rowIx} />
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
