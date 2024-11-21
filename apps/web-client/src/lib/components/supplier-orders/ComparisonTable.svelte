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

	$: totalDelivered = supplierBooks.reduce((acc, supplier) => acc + supplier.books.filter((b) => b.delivered).length, 0);
	$: totalOrdered = supplierBooks.reduce((acc, supplier) => acc + supplier.books.length, 0);

	export let supplierBooks: SupplierBooks[];

	$: getSupplierSummary = (books: Book[]) => {
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
				<th class="w-16">
					<span class="sr-only">Delivered</span>
				</th>
			</tr>
		</thead>
		{#each supplierBooks as { supplier_name, books }}
			<thead>
				<tr class="bg-base-200/50">
					<th colspan="4" class="text-left">
						{supplier_name}
					</th>
					<th colspan="1" class="text-center">
						<span class="badge-accent badge-outline badge-lg badge">
							{getSupplierSummary(books)}
						</span>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each books as { isbn, title, authors, price, delivered }}
					<tr>
						<td>{isbn}</td>
						<td>{title}</td>
						<td>{authors}</td>
						<td>€{price}</td>
						<td class="text-center">
							<input type="checkbox" checked={delivered} disabled class="checkbox" />
						</td>
					</tr>
				{/each}
			</tbody>
		{/each}
	</table>
</div>
