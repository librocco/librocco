<script lang="ts">
	import { createEventDispatcher, onMount, tick } from "svelte";

	import { createSelect } from "@melt-ui/svelte";
	import { Check, ChevronsUpDown, RefreshCcwDot } from "lucide-svelte";

	import { testId } from "@librocco/shared";
	import type { NavEntry } from "@librocco/db";

	import type { WarehouseChangeDetail } from "./types";
	import type { OutboundTableData } from "$lib/components/Tables/types";

	export let data: OutboundTableData;
	export let rowIx: number;
	export let warehouseList: Iterable<[string, NavEntry]> = new Map<string, { displayName: string }>();

	const dispatch = createEventDispatcher<{ change: WarehouseChangeDetail }>();
	const dispatchChange = (warehouseId: string) => dispatch("change", { warehouseId });

	const {
		elements: { trigger, menu, option, label },
		states: { selectedLabel, open, selected },
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

	$: ({ warehouseId, warehouseName, availableWarehouses = new Map<string, { displayName: string; quantity: number }>() } = data);

	const mapWarehousesToOptions = (warehouseList: Iterable<[string, NavEntry]>) =>
		[...warehouseList].map(([value, { displayName }]) => ({ value, label: displayName }));

	/**
	 * If the warehouse is already selected (warehouseId and warehouseName are not undefined), then set the value
	 */
	$: warehouseName && selected.set({ value: warehouseId, label: warehouseName });

	// If there's only one warehouse the book is available in, and the selected warehouse is not that one, change the selected warehouse
	onMount(() => {
		if (availableWarehouses.size !== 1) return;

		const availableWarehouse = availableWarehouses.keys().next().value;
		if (!warehouseId) {
			// Tick isn't necessary here, but it's much easier when testing
			tick().then(() => dispatchChange(availableWarehouse));
		}
	});

	// We're allowing all warehouses for selection.
	// Out of stock situations are handled in the row (painting it red) or
	// when committing the note (prompting for reconciliation)
	$: options = mapWarehousesToOptions(warehouseList);
</script>

<!-- svelte-ignore a11y-label-has-associated-control - $label contains the 'for' attribute -->
<label class="hidden" {...$label} use:label>Select a warehouse to withdraw book {rowIx} from</label>
<button
	data-testid={testId("dropdown-control")}
	data-open={open}
	class="flex w-full gap-x-2 rounded border-2 border-gray-500 bg-white p-2 shadow focus:border-teal-500 focus:outline-none focus:ring-0"
	{...$trigger}
	use:trigger
	aria-label="Warehouse"
>
	<span class="rounded-full p-0.5 {$selectedLabel !== '' ? 'bg-teal-400' : 'bg-red-400'}" />
	{#if $selectedLabel}
		<span class="truncate">
			{$selectedLabel}
		</span>
	{:else}
		<span class="truncate text-gray-400">Select a warehouse</span>
	{/if}
	<ChevronsUpDown size={18} class="ml-auto shrink-0 self-end" />
</button>
{#if $open}
	<div
		data-testid={testId("dropdown-menu")}
		class="z-10 flex max-h-[300px] flex-col gap-y-1.5 overflow-y-auto rounded-lg bg-white p-1 shadow-md focus:!ring-0"
		{...$menu}
		use:menu
	>
		{#each options as warehouse}
			{@const { label, value } = warehouse}
			<div
				class="relative flex cursor-pointer items-center justify-between rounded p-1 text-gray-600 focus:z-10 data-[highlighted]:bg-teal-500 data-[highlighted]:text-white"
				{...$option(warehouse)}
				use:option
			>
				{label}

				<div class="check {$isSelected(value) ? 'block' : 'hidden'}">
					<Check size={18} />
				</div>

				<!-- An icon signifying that the book doesn't exist in the given warehouse - will need reconciliation -->
				<!-- We're not showing this if the warehouse is selected (the highlight takes precedance) -->
				{#if !$isSelected(value)}
					<div>
						<RefreshCcwDot size={18} class={availableWarehouses.has(value) ? "hidden" : "block"} />
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
