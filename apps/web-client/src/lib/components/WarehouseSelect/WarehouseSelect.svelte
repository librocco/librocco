<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import { createSelect } from "@melt-ui/svelte";
	import Check from "$lucide/check";
	import ChevronsUpDown from "$lucide/chevrons-up-down";
	import RefreshCcwDot from "$lucide/refresh-ccw-dot";

	import { testId } from "@librocco/shared";

	import type { WarehouseChangeDetail } from "./types";
	import type { Warehouse } from "$lib/db/cr-sqlite/types";
	import type { InventoryTableData } from "$lib/components/Tables/types";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: InventoryTableData<"book">;
	export let rowIx: number;
	export let warehouseList: Omit<Warehouse, "discount">[];

	const dispatch = createEventDispatcher<{ change: WarehouseChangeDetail }>();
	const dispatchChange = (warehouseId: number) => dispatch("change", { warehouseId });

	const {
		elements: { trigger, menu, option, label },
		states: { selectedLabel, open, selected },
		helpers: { isSelected }
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

	$: ({ warehouseId, warehouseName, availableWarehouses = new Map<number, { displayName: string; quantity: number }>() } = data);

	const mapWarehousesToOptions = (warehouseList: Omit<Warehouse, "discount">[]) =>
		[...warehouseList].map(({ id, displayName }) => ({ value: id, label: displayName }));

	/**
	 * If the warehouse is already selected (warehouseId and warehouseName are not undefined), then set the value
	 */
	$: if (warehouseName) {
		selected.set({ value: warehouseId, label: warehouseName });
	}

	// We're allowing all warehouses for selection.
	// Out of stock situations are handled in the row (painting it red) or
	// when committing the note (prompting for reconciliation)
	$: options = mapWarehousesToOptions(warehouseList);

	$: t = $LL.misc_components.warehouse_select;
</script>

<!-- svelte-ignore a11y-label-has-associated-control - $label contains the 'for' attribute -->
<label class="hidden" {...$label} use:label>{t.label({ rowIx })}</label>
<button
	data-testid={testId("dropdown-control")}
	data-open={open}
	class="border-base flex w-full gap-x-2 rounded border-2 bg-transparent p-2 shadow focus:border-primary focus:outline-none focus:ring-0"
	{...$trigger}
	use:trigger
	aria-label="Warehouse"
>
	<span class="rounded-full p-0.5 {$selectedLabel !== '' ? 'bg-success' : 'bg-error'}"></span>
	{#if $selectedLabel}
		<span class="truncate">
			{$selectedLabel === "not-found" ? t.default_option() : $selectedLabel}
		</span>
	{:else}
		<span class="truncate">{t.default_option()}</span>
	{/if}
	<ChevronsUpDown size={18} class="ml-auto shrink-0 self-end" />
</button>
{#if $open}
	<div
		data-testid={testId("dropdown-menu")}
		class="z-10 flex max-h-[300px] flex-col gap-y-1.5 overflow-y-auto rounded-lg bg-base-100 p-1 text-base-content shadow-md focus:!ring-0"
		{...$menu}
		use:menu
	>
		{#each options as warehouse}
			{@const { label, value } = warehouse}
			<div
				class="relative flex cursor-pointer items-center justify-between rounded p-1 focus:z-10 data-[highlighted]:bg-primary data-[highlighted]:text-primary-content"
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
