<script lang="ts">
	import { quadIn } from 'svelte/easing';

	import { Checkbox } from '..';

	import { fadeBgColor } from '../lib/transitions';

	import type { InventoryTableData } from './types';
	import type { createTable } from './table';

	export let table: ReturnType<typeof createTable<InventoryTableData>>;
	export let row: InventoryTableData & { key: string; rowIx: number };

	const { tableRow } = table;
	$: ({ selected } = $table);

	const isChecked = (event: Event) => (event?.target as HTMLInputElement)?.checked;

	$: ({ rowIx, isbn, title, authors, year, quantity, price } = row);
</script>

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
			<dt class="sr-only lg:hidden">Authors:</dt>
			<dd class="mt-1 truncate font-light text-gray-500 lg:hidden">{authors}</dd>
			<dt class="sr-only sm:hidden">Year:</dt>
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
		<span class="rounded-md bg-gray-100 px-3 py-2">
			{quantity}
		</span>
	</td>
	<td class="py-4 px-3 text-left">
		{price}
	</td>
	<td class="hidden py-4 px-3 text-left sm:table-cell">
		{year}
	</td>
	<slot {row} />
</tr>
