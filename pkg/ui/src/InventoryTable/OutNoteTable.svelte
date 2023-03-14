<script lang="ts">
	import { Button, ButtonColor } from '..';

	import type { OutNoteTableData } from './types';
	import type { createTable } from './table';

	import OutNoteRow from './OutNoteRow.svelte';
	import CoreTableHeaders from './CoreTableHeaders.svelte';

	export let table: ReturnType<typeof createTable<OutNoteTableData>>;

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
			<CoreTableHeaders {table} {headers}>
				<th
					scope="col"
					class="whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500"
				>
					Warehouse
				</th>
			</CoreTableHeaders>
		</thead>

		<tbody>
			{#each rows as row (row.key)}
				<OutNoteRow {table} {row} />
			{/each}
		</tbody>
	</table>
</div>
