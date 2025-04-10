<script lang="ts">
	import { filter, scan } from "rxjs";
	import { onDestroy, onMount } from "svelte";
	import { ArrowRight, ClockArrowUp, Check, MinusCircle, PlusCircle, Delete } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";

	import { asc } from "@librocco/shared";

	import { page } from "$app/stores";
	import { invalidate } from "$app/navigation";

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
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		const disposer1 = rx.onPoint("reconciliationOrder", BigInt($page.params.id), () => invalidate("reconciliationOrder:data"));
		const disposer2 = rx.onRange(["reconciliation_order", "reconciliation_order_lines"], () => invalidate("reconciliationOrder:data"));
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(async () => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data?.dbCtx?.db;

	$: books = data?.reconciliationOrderLines || [];

	$: plugins = data.plugins;

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

	$: t = $LL.suppliers_page.reconcile_page;

	async function handleCommit() {
		// TODO: Implement actual commit logic
		commitDialogOpen.set(false);
		await finalizeReconciliationOrder(db, parseInt($page.params.id));
		await goto(appPath("supplier_orders"));
	}

	const confirmDeleteDialogHeading = "Delete Reconciliation Order";
	const confirmDeleteDialogDescription =
		"Are you sure you want to delete this reconciliation order? This action will delete all the scanned lines.";

	const handleConfirmDeleteDialog = () => {
		deleteDialogOpen.set(true);
	};

	async function handleDelete() {
		deleteDialogOpen.set(false);

		await deleteReconciliationOrder(db, parseInt($page.params.id));

		await goto(appPath("supplier_orders"));
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
					<div class="sticky top-0 flex flex-col gap-y-2 bg-base-100 pb-3">
						<h1 class="prose card-title">{t.title.reconcile_deliveries()}</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{data?.reconciliationOrder.id}</h2>

							<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
								<span class="sr-only">{t.created()}</span>
								<ClockArrowUp size={16} aria-hidden />
								<time dateTime={new Date(data?.reconciliationOrder.created).toISOString()}
									>{new Date(data?.reconciliationOrder.created).toLocaleString()}</time
								>
							</span>
							<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
								<span class="sr-only">{t.last_updated()}</span>
								<ClockArrowUp size={16} aria-hidden />
								<time dateTime={new Date(data?.reconciliationOrder.updatedAt).toISOString()}
									>{new Date(data?.reconciliationOrder.updatedAt).toLocaleString()}</time
								>
							</span>
						</div>
					</div>

					<dl class="prose flex flex-col">
						<div class="md:px-1">
							<dt class="mt-0">{t.includes_supplier_orders()}:</dt>
							<div class="flex flex-wrap gap-x-4 md:flex-col">
								{#each placedOrders as [order_id, supplier_name]}
									<dd class="badge-accent badge-outline badge badge-md gap-x-2">
										#{order_id}
										<span class="text-sm font-light">({supplier_name})</span>
									</dd>
								{/each}
							</div>
						</div>

						<div class="w-full pr-2">
							<button
								class="btn-secondary btn-outline btn-xs btn w-full"
								type="button"
								aria-label="Delete reconciliation order"
								on:click={handleConfirmDeleteDialog}
							>
								<Delete aria-hidden size={16} />
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
									class="flex w-full items-center gap-x-2 px-4 py-2 text-sm {!isCompleted && !isCurrent ? 'text-base-content/50' : ''}"
									disabled={isCurrent || step === 3}
									on:click={async () => {
										currentStep = step;
									}}
								>
									{#if isCompleted}
										<span class="flex shrink-0 items-center justify-center rounded-full bg-primary p-1">
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
						<div class="flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-base-300 p-6">
							<p class="text-center text-base-content/70">{t.no_books()}</p>
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
													on:click={() => {
														if (quantity === 1) {
															handleEditQuantity(isbn, 0);
															return;
														}
														handleEditQuantity(isbn, -1);
													}}
													aria-label="Decrease quantity for isbn: {isbn}"
												>
													<MinusCircle /></button
												>
											</td>
											<td>
												{quantity}
											</td>
											<td>
												<button aria-label="Increase quantity for isbn: {isbn}" on:click={() => handleEditQuantity(isbn, 1)}
													><PlusCircle /></button
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
					<div class="mx-2 flex w-full flex-row justify-between bg-base-300 px-4 py-2 shadow-lg">
						{#if currentStep > 1}
							<dl class="stats flex">
								<div class="stat flex shrink flex-row place-items-center py-2 max-md:px-4">
									<dt class="stat-title">{t.total_delivered()}:</dt>
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
</main>

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
