<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import Truck from "$lucide/truck";

	import { invalidate } from "$app/navigation";

	import { appHash } from "$lib/paths";
	import { createSupplierOrder } from "$lib/db/cr-sqlite/suppliers";
	import { Page } from "$lib/controllers";

	import { racefreeGoto } from "$lib/utils/navigation";

	import type { PageData } from "./$types";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	let disposer: () => void;
	onMount(() => {
		const disposer1 = data.dbCtx?.rx?.onRange(["book"], () => invalidate("books:data"));
		const disposer2 = data.dbCtx?.rx?.onRange(["supplier", "supplier_publisher"], () => invalidate("suppliers:data"));
		const disposer3 = data.dbCtx?.rx?.onRange(["customer_order_lines"], () => invalidate("customers:order_lines"));

		disposer = () => (disposer1(), disposer2(), disposer3());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data?.dbCtx?.db;
	$: ({ orderLines, plugins } = data);

	// Supplier meta data is returned per row. We just need one copy of it
	$: [orderLine] = orderLines;
	$: ({ supplier_id, supplier_name } = orderLine);

	// Initialize with all books selected
	let selectedBooksLookup: { [isbn: string]: boolean } = {};

	// Initialize all books as selected by default
	$: if (orderLines && Object.keys(selectedBooksLookup).length === 0) {
		selectedBooksLookup = orderLines.reduce(
			(acc, { isbn }) => {
				acc[isbn] = true;
				return acc;
			},
			{} as { [isbn: string]: boolean }
		);
	}

	$: linesWithSelection = orderLines.map((line) => ({
		...line,
		selectedQuantity: selectedBooksLookup[line.isbn] ? line.quantity : 0,
		selected_line_price: selectedBooksLookup[line.isbn] ? line.line_price : 0
	}));

	$: totalPossiblePrice = orderLines.reduce((acc, { line_price }) => acc + line_price, 0);
	$: totalSelectedPrice = linesWithSelection.reduce((acc, { selected_line_price }) => acc + selected_line_price, 0);

	$: totalPossibleBooks = orderLines.reduce((acc, { quantity }) => acc + quantity, 0);
	$: totalSelectedBooks = linesWithSelection.reduce((acc, { selectedQuantity }) => acc + selectedQuantity, 0);

	$: canPlaceOrder = totalSelectedBooks > 0;

	$: t = $LL.new_order_page;

	async function handlePlaceOrder() {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		if (!canPlaceOrder) {
			return;
		}

		const selection = linesWithSelection
			.filter(({ selectedQuantity }) => Boolean(selectedQuantity))
			.map(({ isbn, selectedQuantity }) => ({ isbn, quantity: selectedQuantity, supplier_id }));

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createSupplierOrder(db, id, supplier_id, selection);

		// TODO: We could either go to the new supplier order "placed" view when it's created
		// or we could make sure we go to the "placed" list on the suppliers view "/suppliers?s=placed"
		await goto(appHash("supplier_orders", "?filter=unordered"));
	}

	function selectPortion(portion: number) {
		let budget = Math.floor(totalPossiblePrice * portion);
		const selected: { [isbn: string]: boolean } = {};

		// Initialize all as unselected
		for (const line of orderLines) {
			selected[line.isbn] = false;
		}

		// Select books within budget
		for (const line of orderLines) {
			// If this line fits in the budget, select it
			if (line.line_price <= budget) {
				selected[line.isbn] = true;
				budget -= line.line_price;
			} else {
				// If this line doesn't fit, skip it
				selected[line.isbn] = false;
			}
		}

		selectedBooksLookup = selected;
	}
</script>

<Page title={t.title()} view="orders/suppliers/id/new-order" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="min-w-fit md:basis-96 md:overflow-y-auto">
			<div class="card md:h-full">
				<div class="card-body gap-y-2 p-0">
					<div class="flex flex-col gap-y-2 border-b bg-base-100 px-4 py-2.5 max-md:sticky max-md:top-0">
						<div class="flex flex-row items-center justify-between gap-y-4 pb-2 md:flex-col md:items-start">
							<h2 class="text-2xl font-medium">{supplier_name}</h2>

							<span class="badge-primary badge-lg badge badge-md gap-x-2">
								#{supplier_id}
							</span>
						</div>
					</div>

					<dl class="flex w-full border-b px-4 md:flex-col">
						<div class="stats stats-horizontal w-full bg-base-100 md:stats-vertical">
							<div class="stat max-md:p-2 md:px-1">
								<dt class="stat-title">{t.stats.total_books()}</dt>
								<dd class="stat-value text-2xl">{totalPossibleBooks}</dd>
							</div>
							<div class="stat bg-base-100 max-md:py-2 md:px-1">
								<dt class="stat-title">{t.stats.total_value()}</dt>
								<dd class="stat-value text-2xl">€{totalPossiblePrice.toFixed(2)}</dd>
							</div>
						</div>
					</dl>
				</div>
			</div>
		</div>

		<div class="flex h-full w-full flex-col gap-y-6 px-4 md:overflow-y-auto">
			<div class="sticky top-0 flex w-full max-w-full flex-col gap-y-3">
				<div class="flex flex-col items-start justify-between gap-y-2 pb-2 pt-4">
					<h3 class="text-xl font-medium">{t.table.books()}</h3>
					<div class="flex flex-wrap items-center gap-4">
						<div class="flex flex-wrap gap-2">
							<button class="btn-outline btn-sm btn border-dotted" on:click={() => selectPortion(0.25)}>{t.labels.select()} 1/4</button>
							<button class="btn-outline btn-sm btn border-dashed" on:click={() => selectPortion(0.5)}>{t.labels.select()} 1/2</button>
							<button class="btn-outline btn-sm btn" on:click={() => selectPortion(0.75)}>{t.labels.select()} 3/4</button>
						</div>
					</div>
				</div>
			</div>

			<div class="relative h-full overflow-x-auto">
				<table class="table-sm table">
					<thead>
						<tr>
							<th scope="col" class="sr-only"> {t.labels.select()} </th>
							<th>{t.table.isbn()}</th>
							<th>{t.table.title()}</th>
							<th>{t.table.authors()}</th>
							<th>{t.table.quantity()}</th>
							<th>{t.table.total()}</th>
						</tr>
					</thead>

					<tbody>
						{#each linesWithSelection as orderLine}
							{@const { isbn, title, authors, line_price, quantity, selectedQuantity } = orderLine}
							{@const isChecked = selectedBooksLookup[isbn]}
							<tr>
								<td>
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={isChecked}
										on:change={() => {
											selectedBooksLookup[isbn] = !isChecked;
											// eslint-disable-next-line no-self-assign
											selectedBooksLookup = selectedBooksLookup;
										}}
									/>
								</td>
								<th>{isbn}</th>
								<td>{title}</td>
								<td>{authors}</td>

								<td>{quantity}</td>
								<td>€{line_price.toFixed(2)}</td>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if canPlaceOrder}
					<div class="card absolute bottom-4 left-0 z-10 flex w-full flex-row bg-transparent">
						<div class="mx-2 flex w-full flex-row justify-between bg-base-300 px-4 py-2 shadow-lg">
							<dl class="stats flex">
								<div class="stat flex shrink flex-row place-items-center bg-base-300 py-2 max-md:px-4">
									<div class="stat-title">{t.stats.selected_books()}:</div>
									<div class="stat-value text-lg">
										{totalSelectedBooks}
									</div>
								</div>
								<div class="stat flex place-items-center bg-base-300 py-2 max-md:px-4">
									<div class="stat-title sr-only">{t.table.total()}</div>
									<div class="stat-value text-lg">€{totalSelectedPrice.toFixed(2)}</div>
								</div>
							</dl>

							<button class="btn-primary btn" on:click={handlePlaceOrder}>
								{t.labels.place_order()}
								<Truck aria-hidden size={20} class="hidden md:block" />
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</Page>
