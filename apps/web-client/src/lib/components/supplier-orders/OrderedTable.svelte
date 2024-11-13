<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let orders: Array<{
        supplier_name: string;
        supplier_id: number;
        total_book_number: number;
        created: Date;
    }>;

    const dispatch = createEventDispatcher();
    
    let selectedOrders: Set<number> = new Set();
    $: hasSelectedOrders = selectedOrders.size > 0;

    function toggleOrderSelection(supplierId: number) {
        if (selectedOrders.has(supplierId)) {
            selectedOrders.delete(supplierId);
        } else {
            selectedOrders.add(supplierId);
        }
        selectedOrders = selectedOrders; // trigger reactivity
    }

    function handleReconcile(supplierId: number) {
        dispatch('reconcile', { supplierIds: [supplierId] });
    }

    function handleBulkReconcile() {
        dispatch('reconcile', { supplierIds: Array.from(selectedOrders) });
    }
</script>

{#if hasSelectedOrders}
    <div class="sticky top-0 z-10 bg-base-100 shadow-md p-4 mb-4 flex justify-between items-center">
        <span>{selectedOrders.size} orders selected</span>
        <button 
            class="btn-primary btn-sm btn"
            on:click={handleBulkReconcile}
        >
            Reconcile Selected
        </button>
    </div>
{/if}

<table class="table-lg table">
    <thead>
        <tr>
            <th scope="col" class="w-16">
                <span class="sr-only">Select</span>
            </th>
            <th scope="col">Supplier</th>
            <th scope="col">Books</th>
            <th scope="col">Placed</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
    </thead>
    <tbody>
        {#each orders as { supplier_name, supplier_id, total_book_number, created }}
            <tr class="hover focus-within:bg-base-200">
                <td>
                    <input
                        type="checkbox"
                        class="checkbox"
                        checked={selectedOrders.has(supplier_id)}
                        on:change={() => toggleOrderSelection(supplier_id)}
                    />
                </td>
                <td>{supplier_name}</td>
                <td>{total_book_number}</td>
                <td>{created.toLocaleDateString()}</td>
                <td>
                    {#if !hasSelectedOrders}
                        <button 
                            class="btn-primary btn-sm btn"
                            on:click={() => handleReconcile(supplier_id)}
                        >
                            Reconcile
                        </button>
                    {/if}
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    .table-lg td {
        padding-top: 1rem;
        padding-bottom: 1rem;
    }
</style>
