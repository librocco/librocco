<script lang="ts">
	import { createCombobox } from 'svelte-headlessui';
	import { ChevronsUpDown } from 'lucide-svelte';

	import type { OutNoteTableData } from './types';
	import type { createTable } from './table';

	import { ComboboxMenu } from '../Menus';
	import { TextField } from '../FormFields';

	import CoreTableRow from './CoreTableRow.svelte';

	export let table: ReturnType<typeof createTable<OutNoteTableData>>;
	export let row: OutNoteTableData & { key: string; rowIx: number };

	const combobox = createCombobox({ label: `Select ${row.rowIx} warehouse` });

	const options = row.warehouses;
</script>

<CoreTableRow {table} {row}>
	<td class="py-4 px-3">
		{#if options.length > 1}
			<TextField
				name={`${row.isbn} warehouse`}
				inputAction={combobox.input}
				value={$combobox.selected}
				placeholder="Select warehouse..."
			>
				<span
					slot="startAdornment"
					class="rounded-full p-1 {$combobox.selected ? 'bg-teal-400' : 'bg-red-400'}"
				/>
				<svelte:fragment slot="endAdornment">
					<button use:combobox.button type="button" class="flex items-center">
						<ChevronsUpDown class="text-gray-400" />
					</button>
				</svelte:fragment>
			</TextField>
			<div class="relative">
				<ComboboxMenu {combobox} {options} />
			</div>
		{:else}
			<div class="flex items-center rounded-md bg-gray-100 shadow-sm">
				<span class="ml-3 rounded-full bg-teal-400 p-1" />
				<input disabled type="text" value={options[0]} class="border-0 bg-gray-100 text-sm text-gray-500" />
			</div>
		{/if}
	</td>
</CoreTableRow>
