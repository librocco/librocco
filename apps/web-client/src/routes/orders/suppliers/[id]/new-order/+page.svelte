<script lang="ts">
	import { Truck } from "lucide-svelte";
	import { invalidate } from "$app/navigation";

	import { createSupplierOrder } from "$lib/db/cr-sqlite/suppliers";

	import { racefreeGoto } from "$lib/utils/navigation";

	import type { PageData } from "./$types";
	import { base } from "$app/paths";
	import { onDestroy, onMount } from "svelte";

	export let data: PageData;

	// depends("books:data");
	// depends("supplier:data");
	// depends("customers:order_lines");
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		const disposer1 = rx.onRange(["book"], () => invalidate("books:data"));
		const disposer2 = rx.onRange(["supplier", "supplier_publisher"], () => invalidate("suppliers:data"));
		const disposer3 = rx.onRange(["customer_order_lines"], () => invalidate("customers:order_lines"));

		disposer = () => (disposer1(), disposer2(), disposer3());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data?.dbCtx?.db;

	$: ({ orderLines } = data);

	// Supplier meta data is returned per row. We just need one copy of it
	$: [orderLine] = orderLines;
	$: ({
		supplier_id,
		supplier_name
		// last_updated_at // TODO: re-introduce this
	} = orderLine);

	// $: lastUpdatedAtDate = new Date(last_updated_at)

	let selectedBooks = orderLines ?? [];
	$: selectedIsbns = selectedBooks.map(({ isbn }) => isbn);
	$: selectedAmout = selectedBooks.reduce((acc, { line_price }) => acc + line_price, 0);

	$: totalAmount = orderLines.reduce((acc, { line_price }) => acc + line_price, 0);
	$: totalBooks = orderLines.reduce((acc, { quantity }) => acc + quantity, 0);

	$: canPlaceOrder = selectedBooks.length > 0;

	async function handlePlaceOrder() {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		if (!canPlaceOrder) {
			return;
		}

		const selection = orderLines.filter(({ isbn }) => selectedIsbns.includes(isbn));

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createSupplierOrder(db, id, supplier_id, selection);
		await invalidate("suppliers:data");
		// TODO: We could either go to the new supplier order "placed" view when it's created
		// or we could make sure we go to the "placed" list on the suppliers view "/suppliers?s=placed"
		await goto(`${base}/orders/suppliers/orders/`);
	}

	function selectPortion(portion: number) {
		const numToSelect = Math.floor(orderLines.length * portion);

		if (portion === 1 && selectedBooks.length === orderLines.length) {
			selectedBooks = [];
		} else {
			selectedBooks = orderLines.slice(0, numToSelect);
		}
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
						<h1 class="prose card-title">{supplier_name}</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{supplier_id}</h2>
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
								<dd class="stat-value text-2xl">€{totalAmount}</dd>
							</div>
							<!-- TODO: re-introduce last_updated_at -->
							<!-- <div class="stat md:px-1">
								<dt class="stat-title">Last updated</dt>
								<dd class="stat-value text-2xl">
									<time dateTime={lastUpdatedAtDate.toISOString()}>{lastUpdatedAtDate.toLocaleDateString()}</time>
								</dd>
							</div> -->
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
						<button class="btn-outline btn-sm btn border-dotted" on:click={() => selectPortion(1)}>Select All</button>
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
							<th>Quantity</th>
							<th>Total Price</th>
						</tr>
					</thead>
					<tbody>
						{#each orderLines as orderLine}
							{@const { isbn, title, authors, line_price, quantity } = orderLine}
							<tr>
								<td>
									<input
										type="checkbox"
										class="checkbox"
										checked={selectedIsbns.includes(isbn)}
										on:change={() => {
											if (selectedIsbns.includes(isbn)) {
												selectedBooks = selectedBooks.filter((book) => book.isbn !== isbn);
											} else {
												selectedBooks = [...selectedBooks, orderLine];
											}
										}}
									/>
								</td>
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
			{#if canPlaceOrder}
				<div class="card fixed bottom-4 left-0 z-10 flex w-screen flex-row bg-transparent md:absolute md:bottom-24 md:mx-2 md:w-full">
					<div class="mx-2 flex w-full flex-row justify-between bg-base-300 px-4 py-2 shadow-lg">
						<dl class="stats flex">
							<div class="stat flex shrink flex-row place-items-center py-2 max-md:px-4">
								<div class="stat-title">Selected books:</div>
								<div class="stat-value text-lg">
									{selectedBooks.length}
								</div>
							</div>
							<div class="stat flex place-items-center py-2 max-md:px-4">
								<div class="stat-title sr-only">Total</div>
								<div class="stat-value text-lg">€{selectedAmout.toFixed(2)}</div>
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
