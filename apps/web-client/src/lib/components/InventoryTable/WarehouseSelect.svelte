<script lang="ts">
	import { createEventDispatcher, onMount, tick } from "svelte";

	import { createSelect } from "@melt-ui/svelte";
	import { Check, ChevronsUpDown } from "lucide-svelte";

	import type { OutNoteTableData, WarehouseChangeDetail } from "./types";

	export let data: OutNoteTableData;
	export let rowIx: number;

	/** @TODO mvp quick integration */
	const dispatch = createEventDispatcher<{ change: WarehouseChangeDetail }>();
	const dispatchChange = (warehouseId: string) => dispatch("change", { warehouseId });

	// If there's only one warehouse the book is available in, and no warehouseId is specified, select it automatically.
	// onMount(() => {
	// 	if (!warehouseId && availableWarehouses.size === 1) {
	// 		// Tick isn't necessary here, but it's much easier when testing
	// 		tick().then(() => dispatchChange(availableWarehouses.keys().next().value));
	// 	}
	// });

	console.log(data);

	const {
		elements: { trigger, menu, option, label },
		states: { selectedLabel, open },
		helpers: { isSelected }
	} = createSelect<string>({
		forceVisible: true,
		positioning: {
			placement: "bottom",
			sameWidth: true
		},
		onSelectedChange: ({ next }) => {
			const { value } = next;

			dispatchChange(value);

			return next;
		}
	});

	$: ({ warehouseId, warehouseName, availableWarehouses = new Map<string, { displayName: string }>() } = data);

	// $: selectedLabel = availableWarehouses.get($combobox.selected)?.displayName;

	// /** @TODO 'warehouses' type: NavMap */
	const mapWarehousesToOptions = (warehouses: OutNoteTableData["availableWarehouses"]) =>
		[...warehouses].map(([value, { displayName }]) => ({ value, label: displayName }));

	$: options = mapWarehousesToOptions(availableWarehouses);
</script>

{#if options.length > 1}
	<!-- svelte-ignore a11y-label-has-associated-control - $label contains the 'for' attribute -->
	<label class="hidden" {...$label} use:label>Select a warehouse to withdraw book {rowIx} from</label>
	<button class="flex w-full gap-x-3 rounded bg-white p-2 shadow" {...$trigger} use:trigger aria-label="Warehouse">
		<span class="rounded-full p-0.5 {$selectedLabel !== '' ? 'bg-teal-400' : 'bg-red-400'}" />
		{#if $selectedLabel}
			{$selectedLabel}
		{:else}
			<span class="truncate text-gray-400"> Select a warehouse </span>
		{/if}
		<ChevronsUpDown size={18} class="ml-auto shrink-0 self-end" />
	</button>
	{#if $open}
		<div
			class="z-10 flex max-h-[300px] flex-col gap-y-1.5 overflow-y-auto rounded-lg bg-white p-1 shadow focus:!ring-0"
			{...$menu}
			use:menu
		>
			{#each options as warehouse}
				{@const { label } = warehouse}
				<div
					class="data-[highlighted]:bg-teal-500 data-[highlighted]:text-white relative cursor-pointer rounded p-1 text-gray-600 focus:z-10"
					{...$option(warehouse)}
					use:option
				>
					<div class="check {$isSelected(warehouse) ? 'block' : 'hidden'}">
						<Check class="square-4" />
					</div>

					{label}
				</div>
			{/each}
		</div>
	{/if}
{:else}
	<div class="gap-x-2 rounded bg-gray-100 px-2">
		<span class="rounded-full bg-teal-400 p-0.5" />
		<input disabled type="text" value={warehouseName} class="w-full border-0 bg-gray-100 text-sm text-gray-500" />
	</div>
{/if}
