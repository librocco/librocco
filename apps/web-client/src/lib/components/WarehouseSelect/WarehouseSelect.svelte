<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import { createSelect } from "@melt-ui/svelte";
	import ChevronsUpDown from "$lucide/chevrons-up-down";

	import { testId } from "@librocco/shared";

	import type { WarehouseChangeDetail } from "./types";
	import type { InventoryTableData } from "$lib/components/Tables/types";
	import LL from "@librocco/shared/i18n-svelte";

	export let row: InventoryTableData<"book">;
	export let rowIx: number;
	export let scannedQuantitiesPerWarehouse: Map<number, number> | undefined;

	const dispatch = createEventDispatcher<{ change: WarehouseChangeDetail }>();
	const dispatchChange = (warehouseId: number) => dispatch("change", { warehouseId });

	const {
		elements: { trigger, menu, option, label },
		states: { selectedLabel, open, selected }
	} = createSelect<number>({
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

	$: ({ warehouseId, warehouseName, availableWarehouses = new Map<number, { displayName: string; quantity: number }>() } = row);

	const mapAvailableWarehousesToOptions = (
		warehouseList: Map<
			number,
			{
				displayName: string;
				quantity: number;
			}
		>
	) => {
		// Get all warehouses that have stock, regardless of scanned quantities
		const allOptions = [...warehouseList].map(([id, { displayName, quantity }]) => ({ 
			value: id, 
			label: displayName, 
			quantity,
			// Calculate remaining stock (total - scanned)
			remaining: quantity - (scannedQuantitiesPerWarehouse?.get(id) || 0)
		}));
		
		// Don't include the currently selected warehouse if it's out of stock
		// Forced withdrawals should be handled via the force-withdrawal dialog
		
		// Sort by remaining stock (highest first)
		return allOptions.sort((a, b) => b.remaining - a.remaining);
	};

	/**
	 * If the warehouse is already selected (warehouseId and warehouseName are not undefined), then set the value
	 */
	$: if (warehouseName) {
		selected.set({ value: warehouseId, label: warehouseName });
	}

	// We're allowing all warehouses for selection.
	// Out of stock situations are handled in the row (painting it red) or
	// when committing the note (prompting for reconciliation)
	$: options = mapAvailableWarehousesToOptions(availableWarehouses);

	$: t = $LL.misc_components.warehouse_select;
</script>

<!-- svelte-ignore a11y-label-has-associated-control - $label contains the 'for' attribute -->
<label class="hidden" {...$label} use:label>{t.label.aria({ rowIx })}</label>
<button
	data-testid={testId("dropdown-control")}
	data-open={open}
	class="border-base flex w-full gap-x-2 rounded border-2 bg-transparent p-2 shadow focus:border-primary focus:outline-none focus:ring-0"
	{...$trigger}
	use:trigger
>
	<span class="rounded-full p-0.5 {$selectedLabel === 'not-found' ? 'bg-error' : row.type !== 'forced' ? 'bg-success' : 'bg-warning'}"
	></span>

	{#if $selectedLabel !== "not-found"}
		<div class="flex flex-col items-start gap-0.5 truncate">
			<span class="flex flex-row flex-wrap items-center gap-x-2 truncate">
				<span class="font-medium">
					{$selectedLabel}
				</span>
				<span class="text-xs italic">{row.type === "forced" ? "Forced" : ""}</span>
			</span>
			{#if row.type !== "forced" && row.availableWarehouses.get(row.warehouseId)?.quantity}
				<span class="text-xs">
					{t.label.book_count({ count: row.availableWarehouses.get(row.warehouseId)?.quantity })}
				</span>
			{/if}
		</div>
	{:else}
		<span class="font-light text-gray-600">{t.default_option()}</span>
	{/if}
	<ChevronsUpDown size={18} class="ml-auto shrink-0 self-center" />
</button>
{#if $open}
	<div
		data-testid={testId("dropdown-menu")}
		class="z-10 flex max-h-[300px] overflow-y-auto rounded bg-base-100 p-1 text-base-content shadow-md focus:!ring-0"
		{...$menu}
		use:menu
	>
		<div class="flex w-full flex-col">
			{#if options.length}
				<div class="flex flex-col gap-y-0.5">
					{#each options as warehouse}
						{@const { label, quantity } = warehouse}

						<div
							class="relative flex cursor-pointer flex-col rounded p-2 text-sm focus:z-10 data-[highlighted]:bg-primary data-[highlighted]:text-primary-content data-[selected]:bg-primary data-[selected]:text-primary-content"
							{...$option(warehouse)}
							use:option
						>
							<span>{label}</span>
							<span class="text-xs">
								{t.label.book_count({ count: quantity })} 
							</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="p-2 text-sm text-gray-600">
					{t.empty_options()}
				</p>
			{/if}
			<div class="divider m-0 h-0.5"></div>

			<div class="w-full py-1">
				<slot {open} name="force-withdrawal"></slot>
			</div>
		</div>
	</div>
{/if}
