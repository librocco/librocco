<script lang="ts">
	import { createCombobox } from "svelte-headlessui";
	import { ChevronsUpDown } from "lucide-svelte";

	import type { OutNoteTableData, WarehouseChangeDetail } from "./types";

	import { ComboboxMenu } from "../Menus";
	import { TextField } from "../FormFields";

	export let data: OutNoteTableData;
	export let rowIx: number;

	/** @TODO mvp quick integration */
	import { createEventDispatcher, onMount, tick } from "svelte";
	const dispatch = createEventDispatcher<{ change: WarehouseChangeDetail }>();
	const dispatchChange = (warehouseId: string) => dispatch("change", { warehouseId });

	// If there's only one warehouse the book is available in, and no warehouseId is specified, select it automatically.
	onMount(() => {
		if (!warehouseId && availableWarehouses.size === 1) {
			// Tick isn't necessary here, but it's much easier when testing
			tick().then(() => dispatchChange(availableWarehouses.keys().next().value));
		}
	});

	const combobox = createCombobox({ label: `Select ${rowIx} warehouse`, selected: data.warehouseId });

	// To prevent excess updates, we're keeping track of the latest value
	// and dispatching update only when the value changes.
	//
	// This would normally be handled by the fact that the value is string (a value comparable primitive),
	// but since the value is part of an object (state of combobox store), the reactive block is ran on each store
	// update.
	let selected = data.warehouseId;
	$: selected !== $combobox.selected && dispatchChange((selected = $combobox.selected));

	$: ({ warehouseId, warehouseName, availableWarehouses = new Map<string, { displayName: string }>() } = data);

	$: selectedLabel = availableWarehouses.get($combobox.selected)?.displayName;

	/** @TODO 'warehouses' type: NavMap */
	const mapWarehousesToOptions = (warehouses: OutNoteTableData["availableWarehouses"]) =>
		[...warehouses].map(([value, { displayName }]) => ({ value, label: displayName }));
</script>

<td data-property="warehouseName" data-value={selectedLabel} class="py-4 px-1.5">
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
			<input disabled type="text" value={warehouseName} class="w-full border-0 bg-gray-100 text-sm text-gray-500" />
		</div>
	{/if}
</td>
