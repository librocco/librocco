<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from "svelte";
	import Printer from "$lucide/printer";
	import ListTodo from "$lucide/list-todo";
	import SquareArrow from "$lucide/square-arrow-out-up-right";
	import HardDriveDownload from "$lucide/hard-drive-download";

	import type { PageData } from "./$types";

	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { Page } from "$lib/controllers";
	import { appHash } from "$lib/paths";

	import { racefreeGoto } from "$lib/utils/navigation";
	import { invalidate } from "$app/navigation";
	import LL from "@librocco/shared/i18n-svelte";
	import { downloadAsTextFile, generateLinesForDownload } from "$lib/utils/misc";

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

	$: ({ orderLines, id, supplier_id, reconciliation_order_id, plugins } = data);
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
	const dispatch = createEventDispatcher<{ reconcile: { supplierOrderIds: number[] }; download: { supplierOrderId: number } }>();

	function handlePrintOrder() {
		/** @TODO Implement print functionality */
	}
	function handleDownloadOrder(supplierOrderId: number) {
		const generatedLines = generateLinesForDownload(orderLines[0]?.customerId, orderLines[0]?.orderFormat, orderLines);

		downloadAsTextFile(generatedLines, `${supplier_order_id}-${supplier_name}-${orderLines[0]?.orderFormat}`);
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

<Page title={$LL.order_page.title()} view="orders/suppliers/orders/id" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="min-w-fit md:basis-96 md:overflow-y-auto">
			<div class="card md:h-full">
				<div class="card-body gap-y-2 p-0">
					<div
						class="flex flex-row items-center justify-between gap-y-2 border-b bg-base-100 px-4 py-2.5 max-md:sticky max-md:top-0 md:flex-col md:items-start"
					>
						<h2 class="text-2xl font-medium">{supplier_order_id}</h2>

						<div class="flex flex-row items-center justify-between">
							<a class="badge-primary badge-lg badge gap-x-2 hover:badge-outline" href={appHash("suppliers", supplier_id)}>
								{supplier_name}
								<SquareArrow size={12} />
							</a>
						</div>
					</div>
					<dl class="flex w-full border-b px-4 md:flex-col">
						<div class="stats w-full bg-base-100 md:stats-vertical">
							<div class="stat max-md:p-2 md:px-1">
								<dt class="stat-title">{t.stats.total_books()}</dt>
								<dd class="stat-value text-2xl">{total_book_number}</dd>
							</div>
							<div class="stat bg-base-100 max-md:py-2 md:px-1">
								<dt class="stat-title">{t.stats.total_value()}</dt>
								<dd class="stat-value text-2xl">€{total_book_price.toFixed(2)}</dd>
							</div>
							<div class="stat bg-base-100 max-md:py-2 md:px-1">
								<dt class="stat-title">{t.stats.ordered()}</dt>
								<dd class="stat-value text-2xl">
									<time dateTime={createdDate.toString()}>{createdDate.toLocaleDateString()}</time>
								</dd>
							</div>
						</div>
					</dl>
					<div class="card-actions w-full flex-col p-4 md:mb-20">
						<button class="btn-secondary btn-outline btn-sm btn w-full" type="button" disabled on:click={handlePrintOrder}>
							{t.labels.print_order()}
							<Printer aria-hidden size={20} />
						</button>

						{#if reconciled}
							<button
								class="btn-outline btn-sm btn w-full flex-nowrap gap-x-2.5"
								on:click={() => handleViewReconcileOrder(reconciliation_order_id)}
							>
								{t.labels.view_reconciliation()}
								<ListTodo aria-hidden focusable="false" size={20} />
							</button>
						{:else}
							<button class="btn-primary btn-sm btn w-full flex-nowrap gap-x-2.5" on:click={handleReconcileSelf}>
								{t.labels.reconcile()}
								<ListTodo aria-hidden focusable="false" size={20} />
							</button>
						{/if}
						<button class="btn-primary btn-sm btn flex-nowrap gap-x-2.5" on:click={() => handleDownloadOrder(id)}>
							{t.labels.download_order()}
							<HardDriveDownload aria-hidden focusable="false" size={20} />
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="flex h-full w-full flex-col gap-y-6 px-4 md:overflow-y-auto">
			<div class="sticky top-0 flex w-full max-w-full flex-col gap-y-3">
				<div class="flex flex-col items-start justify-between gap-y-2 pb-2 pt-4">
					<h3 class="text-xl font-medium">{t.table.books()}</h3>
				</div>
			</div>

			<div class="relative h-full overflow-x-auto">
				<table class="table-sm table">
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
								<td>€{line_price.toFixed(2)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</Page>
