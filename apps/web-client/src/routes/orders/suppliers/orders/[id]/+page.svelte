<script lang="ts">
	import { ArrowRight } from "lucide-svelte";

	import type { PageData } from "./$types";

	export let data: PageData;

	$: ({ orderLines } = data);

	// Supplier order meta data is returned per row. We just need one copy of it
	$: ({ supplier_order_id, supplier_name, total_book_number, total_book_price, created } = orderLines?.[0] ?? {
		supplier_order_id: 0,
		supplier_name: "",
		total_book_number: 0,
		total_book_price: 0,
		created: 0
	});

	$: createdDate = new Date(created);

	async function handlePrintOrder() {
		/**@TODO implement print functionality */
	}
</script>

<header class="navbar mb-4 bg-neutral">
	<input type="checkbox" value="forest" class="theme-controller toggle" />
</header>

<main class="h-screen">
	<div class="flex h-full flex-col gap-y-10 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="min-w-fit md:basis-96 md:overflow-y-auto">
			<div class="card">
				<div class="card-body gap-y-2 p-0">
					<div class="sticky top-0 flex gap-2 bg-base-100 pb-3 md:flex-col">
						<h1 class="prose card-title">{supplier_order_id}</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{supplier_name}</h2>
						</div>
					</div>
					<dl class="flex flex-col">
						<div class="stats md:stats-vertical">
							<div class="stat md:px-1">
								<dt class="stat-title">Total books</dt>
								<dd class="stat-value text-2xl">{total_book_number}</dd>
							</div>
							<div class="stat md:px-1">
								<dt class="stat-title">Total value</dt>
								<dd class="stat-value text-2xl">€{total_book_price.toFixed(2)}</dd>
							</div>
							<div class="stat md:px-1">
								<dt class="stat-title">Ordered</dt>
								<dd class="stat-value text-2xl">
									<time dateTime={createdDate.toString()}>{createdDate.toLocaleDateString()}</time>
								</dd>
							</div>
						</div>
					</dl>
					<div class="card-actions border-t py-6 md:mb-20">
						<button class="btn-secondary btn-outline btn-sm btn" type="button" disabled on:click={handlePrintOrder}>
							Print Order
							<ArrowRight aria-hidden size={20} />
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="relative mb-20 flex h-full w-full flex-col gap-y-6 md:px-4">
			<div class="prose flex w-full max-w-full flex-col gap-y-3">
				<h3 class="max-md:divider-start max-md:divider">Books</h3>
			</div>

			<div class="relative h-full overflow-x-auto">
				<table class="table-pin-rows table pb-20">
					<thead>
						<tr>
							<th>ISBN</th>
							<th>Title</th>
							<th>Authors</th>
							<th>Quantity</th>
							<th>Total Price</th>
						</tr>
					</thead>
					<tbody>
						{#each orderLines as orderLine}
							{@const { isbn, title, authors, line_price, quantity } = orderLine}
							<tr>
								<th>{isbn}</th>
								<td>{title}</td>
								<td>{authors}</td>
								<td>{quantity}</td>
								<td>€{line_price}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</main>
