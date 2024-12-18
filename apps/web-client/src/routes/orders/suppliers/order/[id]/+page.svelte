<script lang="ts">
	import { invalidate } from "$app/navigation";

	import { Truck } from "lucide-svelte";

	import { createSupplierOrder } from "$lib/db/orders/suppliers";
	import { goto } from "$lib/utils/navigation";

	import type { PageData } from "./$types";
	import { base } from "$app/paths";

	export let data: PageData;

	$: ({ placedOrder, lines } = data);

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
						<h1 class="prose card-title">{placedOrder.id}</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{placedOrder.supplier_name}</h2>
						</div>
					</div>
					<dl class="flex flex-col">
						<div class="stats md:stats-vertical">
							<div class="stat md:px-1">
								<dt class="stat-title">Total books</dt>
								<dd class="stat-value text-2xl">{placedOrder.total_book_number}</dd>
							</div>
							<div class="stat md:px-1">
								<dt class="stat-title">Total value</dt>
								<dd class="stat-value text-2xl">€{"TBD"}</dd>
							</div>
							<div class="stat md:px-1">
								<dt class="stat-title">Last updated</dt>
								<dd class="stat-value text-2xl">
									<!-- <time dateTime={placedOrder.created.toISOString()}>{placedOrder.created.toLocaleDateString()}</time> -->
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
			</div>

			<div class="relative h-full overflow-x-auto">
				<table class="table-pin-rows table pb-20">
					<thead>
						<tr>
							<th>ISBN</th>
							<th>Title</th>
							<th>Authors</th>
							<th>Price</th>
						</tr>
					</thead>
					<tbody>
						{#each lines as orderLine}
							{@const { isbn, title, authors, line_price } = orderLine}
							<tr>
								<th>{isbn}</th>
								<td>{title}</td>
								<td>{authors}</td>
								<td>€{line_price}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="card fixed bottom-4 left-0 z-10 flex w-screen flex-row bg-transparent md:absolute md:bottom-24 md:mx-2 md:w-full">
				<div class="mx-2 flex w-full flex-row justify-between bg-base-300 px-4 py-2 shadow-lg">
					<dl class="stats flex">
						<div class="stat flex shrink flex-row place-items-center py-2 max-md:px-4">
							<div class="stat-title">Selected books:</div>
							<div class="stat-value text-lg">
								{placedOrder.total_book_number}
							</div>
						</div>
						<div class="stat flex place-items-center py-2 max-md:px-4">
							<div class="stat-title sr-only">Total</div>
							<div class="stat-value text-lg">€ TBD</div>
						</div>
					</dl>

					<button class="btn-primary btn" on:click={handlePrintOrder}>
						Print Order
						<Truck aria-hidden size={20} class="hidden md:block" />
					</button>
				</div>
			</div>
		</div>
	</div>
</main>
