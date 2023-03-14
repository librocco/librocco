<script lang="ts">
	import { Checkbox, Button, ButtonColor } from '../';

	import type { InventoryTableData } from './types';
	import type { createTable } from './table';

	import CoreTableRow from './CoreTableRow.svelte';
	import CoreTableHeaders from './CoreTableHeaders.svelte';

	export let table: ReturnType<typeof createTable<InventoryTableData>>;

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

	const { removeRows, table: tableAction } = table;
	$: ({ rows, selected } = $table);

	// table rows + one header row
	$: rowCount = rows.length + 1;
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
			<CoreTableHeaders {table} {headers} let:headers={{ publisher, editedBy, outOfPrint }}>
				<th
					scope="col"
					class="hidden whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500 md:table-cell"
				>
					{publisher}
				</th>
				<th
					scope="col"
					class="hidden whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500 xl:table-cell"
				>
					{editedBy}
				</th>
				<th
					scope="col"
					class="hidden whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500 xl:table-cell"
				>
					{outOfPrint}
				</th>
			</CoreTableHeaders>
		</thead>

		<tbody>
			{#each rows as row (row.key)}
				<CoreTableRow {table} {row} let:row={{ title, publisher, editedBy, outOfPrint }}>
					<td class="hidden py-4 px-3 md:table-cell">
						{publisher}
					</td>
					<td class="hidden py-4 px-3 xl:table-cell">
						{editedBy}
					</td>
					<td class="hidden py-4 px-3 text-center xl:table-cell">
						<span class="inline-block">
							<Checkbox name={`${title} is out of print: ${outOfPrint}`} checked={outOfPrint} disabled />
						</span>
					</td>
				</CoreTableRow>
			{/each}
		</tbody>
	</table>
</div>
