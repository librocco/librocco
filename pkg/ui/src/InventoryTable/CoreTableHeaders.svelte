<script lang="ts">
	import { Checkbox } from '..';

	import type { InventoryTableData } from './types';
	import type { createTable } from './table';

	export let table: ReturnType<typeof createTable<InventoryTableData>>;
	export let headers: Record<keyof InventoryTableData, string>;

	const { tableRow } = table;
	$: ({ selected, rows } = $table);

	const isChecked = (event: Event) => (event?.target as HTMLInputElement)?.checked;
</script>

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
	<th
		scope="col"
		class="table-cell whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500"
	>
		<span class="hidden lg:inline">{headers.isbn}</span>
		<span class="inline lg:hidden">book</span>
	</th>
	<th
		scope="col"
		class="hidden whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500 lg:table-cell"
	>
		{headers.title}
	</th>
	<th
		scope="col"
		class="hidden whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500 lg:table-cell"
	>
		{headers.authors}
	</th>
	<th
		scope="col"
		class="whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500"
	>
		<span class="hidden lg:inline">{headers.quantity}</span>
		<span class="inline lg:hidden">qty</span>
	</th>
	<th
		scope="col"
		class="whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500"
	>
		{headers.price}
	</th>
	<th
		scope="col"
		class="hidden whitespace-nowrap py-4 px-3 text-left text-sm font-medium uppercase tracking-wide text-gray-500 sm:table-cell"
	>
		{headers.year}
	</th>
	<slot {headers} />
</tr>
