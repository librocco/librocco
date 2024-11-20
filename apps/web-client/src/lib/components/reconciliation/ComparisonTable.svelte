<script lang="ts">
    type Book = {
        isbn: string;
        title: string;
        authors: string;
        price: number;
        delivered: boolean;
        ordered: number;
    };

    type SupplierBooks = {
        supplier_name: string;
        supplier_id: number;
        books: Book[];
    };

    export let supplierBooks: SupplierBooks[];

    $: totalDelivered = supplierBooks.reduce((acc, supplier) => 
        acc + supplier.books.filter(b => b.delivered).length, 0
    );
    
    $: totalOrdered = supplierBooks.reduce((acc, supplier) => 
        acc + supplier.books.length, 0
    );

    $: getSupplierSummary = (books: Book[]) => {
        const delivered = books.filter(b => b.delivered).length;
        return `${delivered}/${books.length} delivered`;
    };
</script>

<div class="relative h-full overflow-x-auto">
    <table class="table-pin-rows table pb-20">
        <thead>
            <tr>
                <th class="w-16">Status</th>
                <th>ISBN</th>
                <th>Title</th>
                <th>Authors</th>
                <th>Price</th>
                <th>Ordered</th>
            </tr>
        </thead>
        <tbody>
            {#each supplierBooks as { supplier_name, books }}
                <tr class="bg-base-200">
                    <th colspan="6" class="font-medium">
                        {supplier_name} ({getSupplierSummary(books)})
                    </th>
                </tr>
                {#each books as { isbn, title, authors, price, delivered, ordered }}
                    <tr class:bg-success/10={delivered}>
                        <td>
                            <input
                                type="checkbox"
                                class="checkbox"
                                checked={delivered}
                                disabled
                            />
                        </td>
                        <th>{isbn}</th>
                        <td>{title}</td>
                        <td>{authors}</td>
                        <td>€{price}</td>
                        <td>{ordered}</td>
                    </tr>
                {/each}
            {/each}
        </tbody>
    </table>
</div>

{#if totalOrdered > 0}
    <div class="card fixed bottom-4 left-0 z-10 flex w-screen flex-row bg-transparent md:absolute md:bottom-24 md:mx-2 md:w-full">
        <div class="bg-base-300 mx-2 flex w-full flex-row justify-between px-4 py-2 shadow-lg">
            <dl class="stats flex">
                <div class="stat flex shrink flex-row place-items-center py-2 max-md:px-4">
                    <div class="stat-title">Delivered:</div>
                    <div class="stat-value text-lg">
                        {totalDelivered}/{totalOrdered}
                    </div>
                </div>
            </dl>
            <button class="btn-primary btn" on:click={() => {}}>
                Next step
            </button>
        </div>
    </div>
{/if}
