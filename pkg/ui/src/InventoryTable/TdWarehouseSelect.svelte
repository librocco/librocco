<script lang="ts">
	import { createCombobox } from 'svelte-headlessui';
	import { ChevronsUpDown } from 'lucide-svelte';

	import type { OutNoteTableData } from './types';

	import { ComboboxMenu } from '../Menus';
	import { TextField } from '../FormFields';

	export let data: OutNoteTableData;
	export let rowIx: number;

	const combobox = createCombobox({ label: `Select ${rowIx} warehouse` });

	$: ({ warehouses } = data);
</script>

<td class="py-4 px-1.5">
	{#if warehouses.length > 1}
		<TextField
			name={`Row ${rowIx} warehouse`}
			inputAction={combobox.input}
			value={$combobox.selected}
			placeholder="Select warehouse..."
		>
			<span slot="startAdornment" class="rounded-full p-1 {$combobox.selected ? 'bg-teal-400' : 'bg-red-400'}" />
			<svelte:fragment slot="endAdornment">
				<button use:combobox.button type="button" class="flex items-center">
					<ChevronsUpDown class="text-gray-400" />
				</button>
			</svelte:fragment>
		</TextField>
		<div class="relative">
			<ComboboxMenu {combobox} options={warehouses} />
		</div>
	{:else}
		<div class="flex items-center rounded-md bg-gray-100 shadow-sm">
			<span class="ml-3 rounded-full bg-teal-400 p-1" />
			<input disabled type="text" value={warehouses[0]} class="border-0 bg-gray-100 text-sm text-gray-500" />
		</div>
	{/if}
</td>
