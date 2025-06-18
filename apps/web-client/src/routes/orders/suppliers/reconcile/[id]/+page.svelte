<script lang="ts">
	import ArrowRight from "$lucide/arrow-right";
	import ClockArrowUp from "$lucide/clock-arrow-up";
	import Check from "$lucide/check";
	import MinusCircle from "$lucide/minus-circle";
	import PlusCircle from "$lucide/plus-circle";
	import Trash from "$lucide/trash";
	import { filter, scan } from "rxjs";
	import { onDestroy, onMount } from "svelte";

	import { createDialog } from "@melt-ui/svelte";

	import { asc } from "@librocco/shared";

	import { page } from "$app/stores";
	import { invalidate } from "$app/navigation";

	import { Page } from "$lib/controllers";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import ComparisonTable from "$lib/components/supplier-orders/ComparisonTable.svelte";
	import CommitDialog from "$lib/components/supplier-orders/CommitDialog.svelte";
	import ConfirmDialog from "$lib/components/Dialogs/ConfirmDialog.svelte";
	import DaisyUiScannerForm from "$lib/forms/DaisyUIScannerForm.svelte";
	import { processOrderDelivery } from "$lib/components/supplier-orders/utils";

	import type { PageData } from "./$types";

	import { getBookData, upsertBook } from "$lib/db/cr-sqlite/books";
	import {
		upsertReconciliationOrderLines,
		deleteOrderLineFromReconciliationOrder,
		finalizeReconciliationOrder,
		deleteReconciliationOrder
	} from "$lib/db/cr-sqlite/order-reconciliation";

	import { racefreeGoto } from "$lib/utils/navigation";

	import LL from "@librocco/shared/i18n-svelte";
	import { appPath } from "$lib/paths";

	// implement order reactivity/sync
	export let data: PageData;

	let disposer: () => void;
	onMount(() => {
		const disposer1 = data.dbCtx?.rx?.onPoint("reconciliationOrder", BigInt($page.params.id), () => invalidate("reconciliationOrder:data"));
		const disposer2 = data.dbCtx?.rx?.onRange(["reconciliation_order", "reconciliation_order_lines"], () =>
			invalidate("reconciliationOrder:data")
		);
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(async () => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data?.dbCtx?.db;
	$: ({ reconciliationOrderLines: books = [], plugins } = data);

	async function handleIsbnSubmit(isbn: string) {
		await upsertReconciliationOrderLines(db, parseInt($page.params.id), [{ isbn, quantity: 1 }]);

		// First check if there exists a book entry in the db, if not, fetch book data using external sources
		//
		// Note: this is not terribly efficient, but it's the least ambiguous behaviour to implement
		const localBookData = await getBookData(db, isbn);

		// If book data exists and has 'updatedAt' field - this means we've fetched the book data already
		// no need for further action
		if (localBookData?.updatedAt) {
			return;
		}

		// If local book data doesn't exist at all, create an isbn-only entry
		if (!localBookData) {
			await upsertBook(db, { isbn });
		}

		// At this point there is a simple (isbn-only) book entry, but we should try and fetch the full book data
		plugins
			.get("book-fetcher")
			.fetchBookData(isbn)
			.stream()
			.pipe(
				filter((data) => Boolean(data)),
				// Here we're prefering the latest result to be able to observe the updates as they come in
				scan((acc, next) => ({ ...acc, ...next }))
			)
			.subscribe((b) => upsertBook(db, b));
	}

	$: processedOrderDelivery = processOrderDelivery(data?.reconciliationOrderLines, data?.placedOrderLines);
	// Extract different orders from placedOrderLines
	$: placedOrders = [...new Map(data.placedOrderLines?.map((l) => [l.supplier_order_id, l.supplier_name])).entries()].sort(
		asc(([, supplier_name]) => supplier_name)
	);

	$: totalDelivered = processedOrderDelivery.processedLines.reduce((acc, { deliveredQuantity }) => acc + deliveredQuantity, 0);
	$: totalUnmatched = processedOrderDelivery.unmatchedBooks.reduce((acc, { deliveredQuantity }) => acc + deliveredQuantity, 0);
	$: totalOrdered = data?.placedOrderLines?.reduce((acc, { quantity }) => acc + quantity, 0);

	const handleScanIsbn = (isbn: string) => upsertReconciliationOrderLines(db, parseInt($page.params.id), [{ isbn, quantity: 1 }]);

	const handleEditQuantity = async (isbn: string, quantity: number) => {
		if (quantity === 0) {
			await deleteOrderLineFromReconciliationOrder(db, parseInt($page.params.id), isbn);
			return;
		}
		await upsertReconciliationOrderLines(db, parseInt($page.params.id), [{ isbn, quantity: quantity }]);
	};

	let currentStep = 1;
	const commitDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: commitDialogOpen }
	} = commitDialog;

	const deleteDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: deleteDialogOpen }
	} = deleteDialog;

	$: canCompare = books.length > 0;

	$: t = $LL.reconcile_page;

	async function handleCommit() {
		// TODO: Implement actual commit logic
		commitDialogOpen.set(false);
		await finalizeReconciliationOrder(db, parseInt($page.params.id));
		await goto(appPath("supplier_orders"));
	}

	const handleConfirmDeleteDialog = () => {
		deleteDialogOpen.set(true);
	};

	async function handleDelete() {
		deleteDialogOpen.set(false);

		await deleteReconciliationOrder(db, parseInt($page.params.id));

		await goto(appPath("supplier_orders"));
	}
</script>

<Page title={t.title.reconcile_deliveries()} view="orders/suppliers/reconcile/id" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-10 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="min-w-fit md:basis-96 md:overflow-y-auto">
			<div class="card">
				<div class="card-body gap-y-2 p-0">
					<div class="bg-base-100 sticky top-0 flex flex-col gap-y-2 pb-3">
						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{data?.reconciliationOrder.id}</h2>

							<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
								<span class="sr-only">{t.stats.created()}</span>
								<ClockArrowUp size={16} aria-hidden />
								<time dateTime={new Date(data?.reconciliationOrder.created).toISOString()}
									>{new Date(data?.reconciliationOrder.created).toLocaleString()}</time
								>
							</span>
							<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
								<span class="sr-only">{t.stats.last_updated()}</span>
								<ClockArrowUp size={16} aria-hidden />
								<time dateTime={new Date(data?.reconciliationOrder.updatedAt).toISOString()}
									>{new Date(data?.reconciliationOrder.updatedAt).toLocaleString()}</time
								>
							</span>
							{#if data?.reconciliationOrder.finalized}
								<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
									<span class="sr-only">Finalized At</span>
									<ClockArrowUp size={16} aria-hidden />
									<time dateTime={new Date(data?.reconciliationOrder.updatedAt).toISOString()}
										>{new Date(data?.reconciliationOrder.updatedAt).toLocaleString()}</time
									>
								</span>
							{/if}
						</div>
					</div>

					<dl class="prose flex flex-col">
						<div class="md:px-1">
							<dt class="mt-0">{t.stats.includes_supplier_orders()}:</dt>
							<div class="flex flex-wrap gap-x-4 md:flex-col">
								{#each placedOrders as [order_id, supplier_name]}
									<dd class="badge-accent badge-outline badge badge-md gap-x-2">
										#{order_id}
										<span class="text-sm font-light">({supplier_name})</span>
									</dd>
								{/each}
							</div>
						</div>
						<div class="mt-2 w-full pr-2">
							<button
								class={`btn-secondary btn-outline btn-xs btn w-full ${data?.reconciliationOrder.finalized ? "cursor-default text-gray-400" : ""}`}
								type="button"
								aria-label="Delete reconciliation order"
								on:click={handleConfirmDeleteDialog}
								disabled={data?.reconciliationOrder.finalized}
							>
								<Trash aria-hidden size={16} />
							</button>
						</div>
					</dl>
				</div>
			</div>
		</div>

		<div class="relative mb-20 flex h-full w-full flex-col gap-y-6 md:px-4">
			<div class="prose flex w-full max-w-full flex-col gap-y-3">
				<nav aria-label="Progress">
					<ol role="list" class="flex list-none items-center justify-between divide-x border pl-0">
						{#each [{ title: "Populate", description: "Delivered books" }, { title: "Compare", description: "To ordered" }, { title: "Commit", description: "Notify customers" }] as { title, description }, index}
							{@const step = index + 1}
							{@const isCompleted = step < currentStep}
							{@const isCurrent = step === currentStep}

							<li class="flex-grow">
								<button
									class="flex w-full items-center gap-x-2 px-4 py-2 text-sm {data?.reconciliationOrder.finalized &&
										'cursor-default'} {!isCompleted && !isCurrent ? 'text-base-content/50' : ''}"
									disabled={isCurrent || step === 3 || data?.reconciliationOrder.finalized}
									on:click={async () => (!data?.reconciliationOrder.finalized ? (currentStep = step) : null)}
								>
									{#if isCompleted}
										<span class="bg-primary flex shrink-0 items-center justify-center rounded-full p-1">
											<Check aria-hidden="true" class="text-white" size={22} />
										</span>
									{:else}
										<span
											class="flex shrink-0 items-center justify-center rounded-full border-2 px-2.5 py-1 {!isCurrent
												? 'border-base-content/50'
												: 'border-base-content'}"
										>
											<span>{step}</span>
										</span>
									{/if}
									<span class="inline-flex flex-col items-start text-start">
										<span class="font-medium">{title}</span>
										<span class="font-light max-lg:text-xs max-md:sr-only">{description}</span>
									</span>
								</button>
							</li>
						{/each}
					</ol>
				</nav>

				{#if currentStep === 1}
					<DaisyUiScannerForm onSubmit={handleScanIsbn} />
				{/if}
			</div>

			<div class="relative h-full overflow-x-auto">
				{#if currentStep === 1}
					{#if books.length === 0}
						<div class="border-base-300 flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed p-6">
							<p class="text-base-content/70 text-center">{t.placeholder.description()}</p>
						</div>
					{:else}
						<div class="relative h-full overflow-x-auto">
							<table class="table-pin-rows table pb-20">
								<thead>
									<tr>
										<th>{t.table.isbn()}</th>
										<th>{t.table.title()}</th>
										<th>{t.table.authors()}</th>
										<th>{t.table.price()}</th>
										<th class="w-0"></th>
										<th class="w-2 px-0">{t.table.quantity()}</th>
										<th class="w-0"></th>
									</tr>
								</thead>

								<tbody>
									{#each books as { isbn, title, authors, price, quantity }}
										<tr>
											<th>{isbn}</th>
											<td>{title || "-"}</td>
											<td>{authors || "-"}</td>
											<td>€{price || 0}</td>
											<td>
												<button
													class={`${data?.reconciliationOrder.finalized ? "cursor-default text-gray-400" : ""}`}
													on:click={() => {
														if (quantity === 1) {
															handleEditQuantity(isbn, 0);
															return;
														}
														handleEditQuantity(isbn, -1);
													}}
													aria-label="Decrease quantity for isbn: {isbn}"
													disabled={data?.reconciliationOrder.finalized}
												>
													<MinusCircle /></button
												>
											</td>
											<td>
												{quantity}
											</td>
											<td>
												<button
													class={`${data?.reconciliationOrder.finalized ? "cursor-default text-gray-400" : ""}`}
													disabled={data?.reconciliationOrder.finalized}
													aria-label="Increase quantity for isbn: {isbn}"
													on:click={() => handleEditQuantity(isbn, 1)}><PlusCircle /></button
												>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{:else if currentStep > 1}
					<ComparisonTable reconciledBooks={processedOrderDelivery} />
				{/if}

				<div class="card fixed bottom-4 left-0 z-10 flex w-screen flex-row bg-transparent md:absolute md:bottom-24 md:mx-2 md:w-full">
					<div class="bg-base-300 mx-2 flex w-full flex-row justify-between px-4 py-2 shadow-lg">
						{#if currentStep > 1}
							<dl class="stats flex">
								<div class="stat flex shrink flex-row place-items-center py-2 max-md:px-4">
									<dt class="stat-title">{t.stats.total_delivered()}:</dt>
									<dd class="stat-value text-lg">
										{totalDelivered} / {totalOrdered}
									</dd>
								</div>
							</dl>
						{/if}
						<button
							class="btn-primary btn ml-auto"
							on:click={async () => {
								if (currentStep === 1) {
									currentStep = 2;
								} else {
									commitDialogOpen.set(true);
								}
							}}
						>
							{currentStep === 1 ? "Compare" : "Commit"}
							<ArrowRight aria-hidden size={20} class="hidden md:block" />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</Page>

<PageCenterDialog dialog={commitDialog} title="" description="">
	<CommitDialog
		deliveredBookCount={totalDelivered + totalUnmatched}
		rejectedBookCount={totalOrdered - totalDelivered}
		on:cancel={() => commitDialogOpen.set(false)}
		on:confirm={handleCommit}
	/>
</PageCenterDialog>

<PageCenterDialog dialog={deleteDialog} title="" description="">
	<ConfirmDialog
		on:confirm={handleDelete}
		on:cancel={() => deleteDialogOpen.set(false)}
		heading={t.delete_dialog.title()}
		description={t.delete_dialog.description()}
		labels={{ confirm: "Confirm", cancel: "Cancel" }}
	/>
</PageCenterDialog>
