<script lang="ts">
	import type { SupplierPlacedOrderLine } from "$lib/db/cr-sqlite/suppliers";
	import { sortLinesBySupplier, type ProcessedOrderLine } from "$lib/utils/misc";

	import type { BookEntry } from "@librocco/db";

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

	$: totalDelivered = supplierBooks.length;
	$: totalOrdered = supplierBooks.length;

	export let supplierBooks: ProcessedOrderLine[];

	$: sortedSupplierBooks = sortLinesBySupplier(supplierBooks);
	// list all books by isbn
	// // only show one row per isbn
	//
	$: getSupplierSummary = (books: (BookEntry & { delivered: boolean })[]) => {
		const delivered = books.filter((b) => b.delivered).length;
		return `${delivered} / ${books.length}`;
	};
</script>

<div class="overflow-x-auto">
	<table class="table-pin-rows table">
		<thead>
			<tr>
				<th>ISBN</th>
				<th>Title</th>
				<th>Authors</th>
				<th>Price</th>
				<th>Ordered Quantity</th>
				<th>Delivered Quantity</th>
				<!-- <th class="w-16">
					<span class="sr-only">Delivered</span>
				</th> -->
			</tr>
		</thead>
		{#each Object.entries(sortedSupplierBooks) as [supplier_name, supplierBooksList]}
			<thead>
				<tr class="bg-base-200/50">
					<th colspan="7" class="text-left">
						{supplier_name}
					</th>
					<!-- <th colspan="1" class="text-center">
						<span class="badge-accent badge-outline badge-lg badge">
							{getSupplierSummary(supplierBooks)}
						</span>
					</th> -->
				</tr>
			</thead>
			<tbody>
				{#each supplierBooksList as { isbn, title, authors, price, delivered, deliveredQuantity, orderedQuantity }}
					<tr>
						<td>{isbn}</td>
						<td>{title}</td>
						<td>{authors}</td>
						<td>€{price}</td>
						<td class="text-center">{orderedQuantity}</td>
						<td class="text-center">{deliveredQuantity}</td>
						<td class="text-center">
							<!-- is true if book is in delivered books -->
							<input type="checkbox" checked={deliveredQuantity >= orderedQuantity} disabled class="checkbox" />
						</td>
					</tr>
				{/each}
			</tbody>
		{/each}
	</table>
</div>
