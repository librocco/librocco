<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { fly } from "svelte/transition";
  import Save from "$lucide/save";
  import { testId } from "@librocco/shared";
  import { PageCenterDialog } from "$lib/components/Melt";
  import type { InventoryTableData } from "$lib/components/Tables/types";
  import type { Warehouse } from "$lib/db/cr-sqlite/types";
  import LL from "@librocco/shared/i18n-svelte";

  export let dialog;
  export let row: InventoryTableData<"book">;
  export let warehouses: Warehouse[] = [];
  export let bookRows: Map<string, Map<number, number>>;

  const dispatch = createEventDispatcher<{
    update: { row: InventoryTableData<"book">, warehouseId: number };
    cancel: void;
  }>();

  let selectedWarehouse: Warehouse | null = null;
  
  // Reset selected warehouse when dialog opens
  $: if ($dialog.states.open) {
    selectedWarehouse = null;
  }

  $: tOutbound = $LL.sale_note;
</script>

<PageCenterDialog {dialog} title="" description="">
  <div class="prose">
    <h3>
      {tOutbound.force_withdrawal_dialog.title({ isbn: row.isbn })}
    </h3>
    <p>{tOutbound.force_withdrawal_dialog.description()}</p>

    <div class="stretch flex w-full flex-col gap-y-6">
      <select 
        id="warehouse-force-withdrawal" 
        bind:value={selectedWarehouse} 
        class="select-bordered select w-full"
        data-testid={testId("force-withdrawal-select")}
      >
        <option value={null} disabled selected>{$LL.misc_components.warehouse_select.default_option()}</option>
        {#each warehouses as warehouse}
          {@const stock = row.availableWarehouses.get(warehouse.id)?.quantity || 0}
          {@const scanned = bookRows.get(row.isbn)?.get(warehouse.id) || 0}
          {@const availableForForcing = scanned >= stock}
          <option class={availableForForcing ? "" : "hidden"} value={warehouse}>{warehouse.displayName}</option>
        {/each}
      </select>
      
      {#if selectedWarehouse}
        <p class="m-0">
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
              dispatch('cancel');
              dialog.states.open.set(false);
            }} 
            class="btn-secondary btn-outline btn-lg btn" 
            type="button"
            data-testid={testId("force-withdrawal-cancel")}
          >
            {tOutbound.force_withdrawal_dialog.cancel()}
          </button>
        </div>

        <div class="grow">
          <button
            on:click={() => {
              if (selectedWarehouse) {
                dispatch('update', { row, warehouseId: selectedWarehouse.id });
                dialog.states.open.set(false);
              }
            }}
            class="btn-primary btn-lg btn w-full"
            disabled={selectedWarehouse === null}
            data-testid={testId("force-withdrawal-confirm")}
          >
            <Save aria-hidden="true" focusable="false" size={20} />
            {tOutbound.force_withdrawal_dialog.confirm()}
          </button>
        </div>
      </div>
    </div>
  </div>
</PageCenterDialog>
