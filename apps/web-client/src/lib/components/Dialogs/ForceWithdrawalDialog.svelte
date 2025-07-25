<script lang="ts">
	import { onMount } from "svelte";
	import Save from "$lucide/save";
	import type { Dialog } from "@melt-ui/svelte";

	import LL from "@librocco/shared/i18n-svelte";

	import { PageCenterDialog } from "$lib/components/Melt";
	import { clickOutside } from "$lib/actions";

	import type { InventoryTableData } from "$lib/components/Tables/types";
	import type { Warehouse } from "$lib/db/cr-sqlite/types";

	export let dialog: Dialog;
	export let row: InventoryTableData<"book">;
	export let warehouses: Warehouse[] = [];
	export let bookRows: Map<string, Map<number, number>>;
	export let onSave: (row: InventoryTableData<"book">, warehouseId: number) => void = (row, warehouseId) => {};
	export let onCancel = () => {};

	let selectedId: Warehouse["id"] | null = null;
	$: selectedWarehouse = warehouses.find((w) => w.id === selectedId);

	// If there is an existing "forced" selection, display it
	onMount(() => {
		if (row.type === "forced" && row.warehouseId) {
			selectedId = row.warehouseId;
		}
	});

	$: tOutbound = $LL.sale_note;
</script>

<PageCenterDialog {dialog} title="" description="">
	<div class="prose" use:clickOutside on:clickoutside={() => onCancel()}>
		<h3>
			{tOutbound.force_withdrawal_dialog.title({ isbn: row.isbn })}
		</h3>
		<p>{tOutbound.force_withdrawal_dialog.description()}</p>

		<div class="stretch flex w-full flex-col gap-y-6">
			<select id="warehouse-force-withdrawal" bind:value={selectedId} class="select-bordered select w-full">
				<option value={null} disabled selected>{$LL.misc_components.warehouse_select.default_option()}</option>
				{#each warehouses as { id, displayName }}
					{@const stock = row.availableWarehouses.get(id)?.quantity || 0}
					{@const scanned = bookRows.get(row.isbn)?.get(id) || 0}

					{@const availableForForcing = stock === 0 || stock < scanned}
					
					<option class={availableForForcing ? "" : "hidden"} value={id}>{displayName}</option>
				{/each}
			</select>

			{#if selectedId}
				<p class="m-0 font-bold">
					{tOutbound.force_withdrawal_dialog.selected_warehouse_message({
						quantity: row.quantity,
						isbn: row.isbn,
						displayName: selectedWarehouse.displayName
					})}
				</p>
			{/if}

			<div class="flex gap-x-4">
				<div class="basis-fit">
					<button
						on:click={() => {
							onCancel();
							dialog.states.open.set(false);
						}}
						class="btn-secondary btn-outline btn-lg btn"
						type="button"
					>
						{tOutbound.force_withdrawal_dialog.cancel()}
					</button>
				</div>

				<div class="grow">
					<button
						on:click={() => {
							onSave(row, selectedWarehouse.id);

							dialog.states.open.set(false);
						}}
						class="btn-primary btn-lg btn w-full"
						disabled={selectedId === row.warehouseId || selectedId === null}
					>
						<Save aria-hidden="true" focusable="false" size={20} />
						{tOutbound.force_withdrawal_dialog.confirm()}
					</button>
				</div>
			</div>
		</div>
	</div>
</PageCenterDialog>
