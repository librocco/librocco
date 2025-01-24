<script lang="ts">
	import { sortLinesBySupplier } from "$lib/db/cr-sqlite/order-reconciliation";
	import type { ProcessedOrderLine, SupplierPlacedOrderLine } from "$lib/db/cr-sqlite/types";

	import type { BookEntry } from "@librocco/db";
	import { onMount } from "svelte";

	export let reconciledBooks: { processedLines: ProcessedOrderLine[]; unmatchedBooks: (BookEntry & { quantity: number })[] } = {
		processedLines: [],
		unmatchedBooks: []
	};

	$: sortedSupplierBooks = sortLinesBySupplier(reconciledBooks.processedLines);

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
		{#if reconciledBooks.unmatchedBooks.length}
			<thead>
				<tr class="bg-base-200/50">
					<th colspan="7" class="text-left"> Unmatched Books </th>
				</tr>
			</thead>
			<tbody>
				{#each reconciledBooks.unmatchedBooks as { isbn, title, authors, price }}
					<tr>
						<td>{isbn}</td>
						<td>{title}</td>
						<td>{authors}</td>
						<td>€{price}</td>
					</tr>
				{/each}
			</tbody>
		{/if}
		{#each Object.entries(sortedSupplierBooks) as [supplier_name, reconciledBooksList]}
			<thead>
				<tr class="bg-base-200/50">
					<th colspan="7" class="text-left">
						{supplier_name || ""}
					</th>
					<!-- <th colspan="1" class="text-center">
						<span class="badge-accent badge-outline badge-lg badge">
							{getSupplierSummary(reconciledBooks)}
						</span>
					</th> -->
				</tr>
			</thead>
			<tbody>
				{#each reconciledBooksList as { isbn, title, authors, price, deliveredQuantity, orderedQuantity }}
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
