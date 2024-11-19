<script lang="ts">
	import { Truck } from "lucide-svelte";

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
		},
		{
			isbn: "9780987654321",
			title: "Becoming",
			authors: "Michelle Obama",
			price: 19.5,
			quantity: 3
		},
		{
			isbn: "9780987654314",
			title: "Thinking, Fast and Slow",
			authors: "Daniel Kahneman",
			price: 12.99,
			quantity: 4
		},
		{
			isbn: "9780987654307",
			title: "The Power of Habit",
			authors: "Charles Duhigg",
			price: 13.5,
			quantity: 2
		},
		{
			isbn: "9781234567873",
			title: "Atomic Habits",
			authors: "James Clear",
			price: 16.99,
			quantity: 5
		},
		{
			isbn: "9781234567866",
			title: "Educated",
			authors: "Tara Westover",
			price: 14.99,
			quantity: 1
		},
		{
			isbn: "9781234567859",
			title: "Sapiens",
			authors: "Yuval Noah Harari",
			price: 22.5,
			quantity: 3
		}
	];

	// Mock supplier data
	const supplier = {
		name: "Academic Books Ltd",
		id: 123,
		lastUpdated: new Date()
	};

	let selectedBooks = new Set<string>();
	$: totalAmount = Array.from(selectedBooks).reduce((acc, isbn) => {
		const book = books.find((b) => b.isbn === isbn);
		return acc + (book?.price || 0);
	}, 0);

	$: canPlaceOrder = selectedBooks.size > 0;

	function handlePlaceOrder() {
		if (!canPlaceOrder) return;
		console.log("Placing order for books:", Array.from(selectedBooks));
		// TODO: Implement order placement
	}

	$: totalBooks = books.length;
	$: totalValue = books.reduce((sum, book) => sum + book.price, 0).toFixed(2);

	function selectPortion(portion: number) {
		const numToSelect = Math.floor(books.length * portion);
		selectedBooks = new Set(books.slice(0, numToSelect).map((b) => b.isbn));
	}
</script>

<main class="h-screen">
	<header class="navbar mb-4 bg-neutral">
		<input type="checkbox" value="forest" class="theme-controller toggle" />
	</header>

	<div class="flex h-full flex-col gap-y-6 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="min-w-fit md:basis-96 md:overflow-y-auto">
			<div class="card">
				<div class="card-body gap-y-2 p-0">
					<div class="sticky top-0 flex gap-2 bg-base-100 pb-3 md:flex-col">
						<h1 class="prose card-title">{supplier.name}</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{supplier.id}</h2>
						</div>
					</div>
					<dl class="flex flex-col">
						<div class="stats md:stats-vertical">
							<div class="stat md:px-1">
								<dt class="stat-title">Total books</dt>
								<dd class="stat-value text-2xl">{totalBooks}</dd>
							</div>
							<div class="stat md:px-1">
								<dt class="stat-title">Total value</dt>
								<dd class="stat-value text-2xl">€{totalValue}</dd>
							</div>
							<div class="stat md:px-1">
								<dt class="stat-title">Last updated</dt>
								<dd class="stat-value text-2xl">
									<time dateTime={supplier.lastUpdated.toISOString()}>{supplier.lastUpdated.toLocaleDateString()}</time>
								</dd>
							</div>
						</div>
					</dl>
				</div>
			</div>
		</div>

		<div class="relative mb-20 flex h-full w-full flex-col gap-y-6 md:px-4">
			<div class="prose flex w-full max-w-full flex-col gap-y-3">
				<h3 class="max-md:divider-start max-md:divider">Books</h3>
				<div class="flex flex-wrap items-center gap-4">
					<div class="flex flex-wrap gap-2">
						<button class="btn-outline btn-sm btn border-dotted" on:click={() => selectPortion(0.25)}>Select 1/4</button>
						<button class="btn-outline btn-sm btn border-dashed" on:click={() => selectPortion(0.5)}>Select 1/2</button>
						<button class="btn-outline btn-sm btn" on:click={() => selectPortion(0.75)}>Select 3/4</button>
					</div>
				</div>
			</div>

			<div class="relative h-full overflow-x-auto">
				<table class="table-pin-rows table pb-20">
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
			{#if canPlaceOrder}
				<div class="card fixed bottom-4 left-0 z-10 flex w-screen flex-row bg-transparent md:absolute md:bottom-24 md:mx-2 md:w-full">
					<div class="mx-2 flex w-full flex-row justify-between bg-base-300 px-4 py-2 shadow-lg">
						<dl class="stats flex">
							<div class="stat flex shrink flex-row place-items-center py-2 max-md:px-4">
								<div class="stat-title">Selected books:</div>
								<div class="stat-value text-lg">
									{selectedBooks.size}
								</div>
							</div>
							<div class="stat flex place-items-center py-2 max-md:px-4">
								<div class="stat-title sr-only">Total</div>
								<div class="stat-value text-lg">€{totalAmount.toFixed(2)}</div>
							</div>
						</dl>
						<button class="btn-primary btn" on:click={handlePlaceOrder}>
							Place Order
							<Truck aria-hidden size={20} class="hidden md:block" />
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</main>
