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
<script lang="ts">
	export let supplierBooks: Array<{
		supplier_name: string;
		supplier_id: number;
		books: Array<{
			isbn: string;
			title: string;
			authors: string;
			price: number;
			delivered: boolean;
			ordered: number;
		}>;
	}>;

	$: totalDelivered = supplierBooks.reduce((acc, supplier) => acc + supplier.books.filter((b) => b.delivered).length, 0);
	$: totalOrdered = supplierBooks.reduce((acc, supplier) => acc + supplier.books.length, 0);
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
		<tbody>
			{#each supplierBooks as { supplier_name, books }}
				<tr class="bg-base-200/50">
					<th colspan="5" class="text-right">
						<span class="badge badge-lg gap-2">
							{supplier_name} {books.filter((b) => b.delivered).length} / {books.length}
						</span>
					</th>
				</tr>
				{#each books as { isbn, title, authors, price, delivered }}
					<tr>
						<td>{isbn}</td>
						<td>{title}</td>
						<td>{authors}</td>
						<td>€{price}</td>
						<td>
							<input type="checkbox" checked={delivered} disabled class="checkbox" />
						</td>
					</tr>
				{/each}
			{/each}
			<tr class="bg-base-300">
				<th colspan="5" class="text-right">
					<span class="badge badge-lg gap-2">
						Total {totalDelivered} / {totalOrdered}
					</span>
				</th>
			</tr>
		</tbody>
	</table>
</div>
