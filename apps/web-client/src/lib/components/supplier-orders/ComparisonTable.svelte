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

	$: getSupplierSummary = (books: Book[]) => {
		const delivered = books.filter((b) => b.delivered).length;
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
					<tr class={delivered ? "bg-success/10" : ""}>
						<td>
							<input type="checkbox" class="checkbox" checked={delivered} disabled />
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
