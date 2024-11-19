<script lang="ts">
	import { ArrowRight } from "lucide-svelte";

	// TODO: Replace with actual DB call
	let books = [
		{
			isbn: "9781234567897",
			title: "The Art of Learning",
			authors: "Josh Waitzkin",
			price: 15.99,
			quantity: 2
		},
		{
			isbn: "9781234567880",
			title: "Deep Work",
			authors: "Cal Newport",
			price: 18.0,
			quantity: 1
		}
	];

	let selectedBooks = new Set<string>();
	$: totalAmount = Array.from(selectedBooks).reduce((acc, isbn) => {
		const book = books.find(b => b.isbn === isbn);
		return acc + (book?.price || 0);
	}, 0);

	$: canPlaceOrder = selectedBooks.size > 0;

	function handlePlaceOrder() {
		if (!canPlaceOrder) return;
		console.log("Placing order for books:", Array.from(selectedBooks));
		// TODO: Implement order placement
	}
</script>

<main class="h-screen">
	<header class="navbar mb-4 bg-neutral">
		<input type="checkbox" value="forest" class="theme-controller toggle" />
	</header>

	<div class="flex h-full flex-col gap-y-6 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="h-full w-full md:overflow-y-auto">
			<div class="prose flex w-full max-w-full flex-col gap-y-3">
				<h1 class="text-2xl font-bold">Place Supplier Order</h1>
			</div>

			<div class="h-full overflow-x-auto">
				<table class="table-pin-rows table">
					<thead>
						<tr>
							<th class="w-16">
								<span class="sr-only">Select</span>
							</th>
							<th>ISBN</th>
							<th>Title</th>
							<th>Authors</th>
							<th>Price</th>
						</tr>
					</thead>
					<tbody>
						{#each books as { isbn, title, authors, price }}
							<tr>
								<td>
									<input
										type="checkbox"
										class="checkbox"
										checked={selectedBooks.has(isbn)}
										on:change={() => {
											if (selectedBooks.has(isbn)) {
												selectedBooks.delete(isbn);
											} else {
												selectedBooks.add(isbn);
											}
											selectedBooks = selectedBooks;
										}}
									/>
								</td>
								<th>{isbn}</th>
								<td>{title}</td>
								<td>{authors}</td>
								<td>€{price}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="sticky bottom-0 w-full bg-base-100 p-4 shadow-lg md:static md:w-96 md:shadow-none">
			<div class="flex flex-col gap-4">
				<dl class="stats stats-vertical shadow">
					<div class="stat">
						<dt class="stat-title">Selected Books</dt>
						<dd class="stat-value">{selectedBooks.size}</dd>
					</div>
					<div class="stat">
						<dt class="stat-title">Total Amount</dt>
						<dd class="stat-value">€{totalAmount.toFixed(2)}</dd>
					</div>
				</dl>
				<button
					class="btn-primary btn w-full"
					disabled={!canPlaceOrder}
					on:click={handlePlaceOrder}
				>
					Place Order
					<ArrowRight aria-hidden size={20} />
				</button>
			</div>
		</div>
	</div>
</main>

<style>
	.table td {
		padding-top: 1rem;
		padding-bottom: 1rem;
	}
</style>
