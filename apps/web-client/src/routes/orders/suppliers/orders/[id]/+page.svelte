<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { ArrowRight, ListTodo } from "lucide-svelte";

	import type { PageData } from "./$types";

	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { Page } from "$lib/controllers";
	import { appHash } from "$lib/paths";

	import { racefreeGoto } from "$lib/utils/navigation";
	import { invalidate } from "$app/navigation";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;

	onMount(() => {
		const disposer1 = data.dbCtx?.rx?.onRange(["reconciliation_order"], () => invalidate("reconciliation:orders"));
		const disposer2 = data.dbCtx?.rx?.onRange(["book"], () => invalidate("book:data"));
		disposer = () => (disposer1(), disposer2());
	});

	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	// #endregion reactivity
	$: goto = racefreeGoto(disposer);

	$: ({ orderLines, id, reconciliation_order_id, plugins } = data);
	$: db = data?.dbCtx?.db;

	// Supplier order meta data is returned per row. We just need one copy of it
	$: ({ supplier_order_id, supplier_name, total_book_number, total_book_price, created } = orderLines?.[0] ?? {
		supplier_order_id: 0,
		supplier_name: "",
		total_book_number: 0,
		total_book_price: 0,
		created: 0
	});

	$: createdDate = new Date(created);
	$: reconciled = reconciliation_order_id !== null && reconciliation_order_id !== undefined;

	$: t = $LL.reconciled_list_page;
	async function handlePrintOrder() {
		/**@TODO implement print functionality */
	}

	async function handleReconcileSelf() {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1
		const reconOrderId = Math.floor(Math.random() * 1000000); // Temporary ID generation

		await createReconciliationOrder(db, reconOrderId, [id]);
		goto(appHash("reconcile", reconOrderId));
	}

	function handleViewReconcileOrder(id: number) {
		goto(appHash("reconcile", id));
	}
</script>

<Page title="Supplier Orders" view="orders/suppliers/orders/id" {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col gap-y-10 px-4">
		<div class="flex h-full flex-col gap-y-10 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
			<div class="min-w-fit md:basis-96 md:overflow-y-auto">
				<div class="card">
					<div class="card-body gap-y-2 p-0">
						<div class="sticky top-0 flex gap-2 bg-base-100 pb-3 md:flex-col">
							<h1 class="prose card-title">{supplier_order_id}</h1>

							{#if reconciled}
								<button
									class="btn-outline btn-sm btn flex-nowrap gap-x-2.5"
									on:click={() => handleViewReconcileOrder(reconciliation_order_id)}
								>
									<ListTodo aria-hidden focusable="false" size={20} />
									{t.labels.view_reconciliation()}
								</button>
							{:else}
								<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={handleReconcileSelf}>
									<ListTodo aria-hidden focusable="false" size={20} />
									{t.labels.reconcile()}
								</button>
							{/if}

							<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
								<h2 class="prose">#{supplier_name}</h2>
							</div>
						</div>
						<dl class="flex flex-col">
							<div class="stats md:stats-vertical">
								<div class="stat md:px-1">
									<dt class="stat-title">{t.stats.total_books()}</dt>
									<dd class="stat-value text-2xl">{total_book_number}</dd>
								</div>
								<div class="stat md:px-1">
									<dt class="stat-title">{t.stats.total_value()}</dt>
									<dd class="stat-value text-2xl">€{total_book_price.toFixed(2)}</dd>
								</div>
								<div class="stat md:px-1">
									<dt class="stat-title">{t.stats.ordered()}</dt>
									<dd class="stat-value text-2xl">
										<time dateTime={createdDate.toString()}>{createdDate.toLocaleDateString()}</time>
									</dd>
								</div>
							</div>
						</dl>
						<div class="card-actions border-t py-6 md:mb-20">
							<button class="btn-secondary btn-outline btn-sm btn" type="button" disabled on:click={handlePrintOrder}>
								{t.labels.print_order()}
								<ArrowRight aria-hidden size={20} />
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="relative mb-20 flex h-full w-full flex-col gap-y-6 md:px-4">
				<div class="prose flex w-full max-w-full flex-col gap-y-3">
					<h3 class="max-md:divider-start max-md:divider">{t.table.books()}</h3>
				</div>

				<div class="relative h-full overflow-x-auto">
					<table class="table-pin-rows table pb-20">
						<thead>
							<tr>
								<th>{t.table.isbn()}</th>
								<th>{t.table.title()}</th>
								<th>{t.table.authors()}</th>
								<th>{t.table.quantity()}</th>
								<th>{t.table.total_price()}</th>
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
	</div>
</Page>
