<script lang="ts">
	import { createCombobox } from "svelte-headlessui";
	import { ChevronsUpDown } from "lucide-svelte";

	import type { OutNoteTableData, WarehouseChangeDetail } from "./types";

	import { ComboboxMenu } from "../Menus";
	import { TextField } from "../FormFields";

	export let data: OutNoteTableData;
	export let rowIx: number;

	/** @TODO mvp quick integration */
	import { createEventDispatcher } from "svelte";
	const dispatch = createEventDispatcher<{ change: WarehouseChangeDetail }>();
	const dispatchChange = (warehouseId: string) => dispatch("change", { warehouseId });

	const combobox = createCombobox({ label: `Select ${rowIx} warehouse`, selected: data.warehouseId });

	$: dispatchChange($combobox.selected);

	$: ({ warehouseName, availableWarehouses = new Map() } = data);

	$: selectedLabel = availableWarehouses.get($combobox.selected)?.displayName;

	/** @TODO 'warehouses' type: NavMap */
	const mapWarehousesToOptions = (warehouses: OutNoteTableData["availableWarehouses"]) =>
		[...warehouses].map(([value, { displayName }]) => ({ value, label: displayName }));
</script>

<td class="py-4 px-1.5">
	{#if availableWarehouses?.size > 1}
		<TextField name={`Row ${rowIx} warehouse`} inputAction={combobox.input} value={selectedLabel} placeholder="Select warehouse...">
			<span slot="startAdornment" class="rounded-full p-1 {$combobox.selected ? 'bg-teal-400' : 'bg-red-400'}" />
			<svelte:fragment slot="endAdornment">
				<button use:combobox.button type="button" class="flex items-center">
					<ChevronsUpDown class="text-gray-400" />
				</button>
			</svelte:fragment>
		</TextField>
		<div class="relative">
			<ComboboxMenu {combobox} options={mapWarehousesToOptions(availableWarehouses)} />
		</div>
	{:else}
		<div class="flex items-center rounded-md bg-gray-100 shadow-sm">
			<span class="ml-3 rounded-full bg-teal-400 p-1" />
			<input disabled type="text" value={warehouseName} class="border-0 bg-gray-100 text-sm text-gray-500" />
		</div>
	{/if}
</td>
