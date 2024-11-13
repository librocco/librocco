<script lang="ts">
    export let orders: Array<{
        supplier_name: string;
        supplier_id: number;
        total_book_number: number;
    }>;

    function handlePlaceOrder(supplierId: number) {
        // TODO: Implement order placement
        console.log("Placing order for supplier:", supplierId);
    }
</script>

<table class="table-lg table">
    <thead>
        <tr>
            <th scope="col">Supplier</th>
            <th scope="col">Books</th>
            <th scope="col"><span class="sr-only">Place order</span></th>
        </tr>
    </thead>
    <tbody>
        {#each orders as { supplier_name, supplier_id, total_book_number }}
            <tr class="hover focus-within:bg-base-200">
                <td>{supplier_name}</td>
                <td>{total_book_number}</td>
                <td>
                    <button 
                        class="btn-primary btn-sm btn" 
                        on:click={() => handlePlaceOrder(supplier_id)}
                    >
                        Place Order
                    </button>
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
