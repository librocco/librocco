<script lang="ts">
	import ArrowRight from "$lucide/arrow-right";
	import ClockArrowUp from "$lucide/clock-arrow-up";
	import Check from "$lucide/check";
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
	import ReconcileStep1 from "./ReconcileStep1.svelte";
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
	import { formatters as dateFormatters } from "@librocco/shared/i18n-formatters";
	import { appPath } from "$lib/paths";

	import { app } from "$lib/app";
	import { getDb, getDbRx } from "$lib/app/db";

	// implement order reactivity/sync
	export let data: PageData;

	let disposer: () => void;
	onMount(() => {
		const disposer1 = getDbRx(app).onPoint("reconciliationOrder", BigInt($page.params.id), () => invalidate("reconciliationOrder:data"));
		const disposer2 = getDbRx(app).onRange(["reconciliation_order", "reconciliation_order_lines"], () =>
			invalidate("reconciliationOrder:data")
		);
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(async () => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	$: ({ reconciliationOrderLines: books = [], plugins } = data);

	async function handleIsbnSubmit(isbn: string) {
		const db = await getDb(app);
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

	const handleScanIsbn = async (isbn: string) =>
		upsertReconciliationOrderLines(await getDb(app), parseInt($page.params.id), [{ isbn, quantity: 1 }]);

	// Supports only incdement / decrement by 1
	const handleEditQuantity = (quantity: -1 | 1) => async (isbn: string) => {
		const db = await getDb(app);
		await upsertReconciliationOrderLines(db, parseInt($page.params.id), [{ isbn, quantity }]);
	};

	let currentStep = data?.reconciliationOrder.finalized ? 2 : 1;
	const commitDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: commitDialogOpen }
	} = commitDialog;

	const deleteDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: deleteDialogOpen }
	} = deleteDialog;

	$: t = $LL.reconcile_page;

	async function handleCommit() {
		// TODO: Implement actual commit logic
		commitDialogOpen.set(false);

		const db = await getDb(app);
		await finalizeReconciliationOrder(db, parseInt($page.params.id));
		await goto(appPath("supplier_orders"));
	}

	const handleConfirmDeleteDialog = () => {
		deleteDialogOpen.set(true);
	};

	async function handleDelete() {
		deleteDialogOpen.set(false);

		const db = await getDb(app);
		await deleteReconciliationOrder(db, parseInt($page.params.id));

		await goto(appPath("supplier_orders", "?filter=ordered"));
	}
</script>

<Page title={t.title.reconcile_deliveries()} view="orders/suppliers/reconcile/id" {app} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-10 overflow-hidden md:divide-x">
		<div class="relative flex h-full w-full flex-1 flex-col gap-y-6 overflow-hidden">
			<div class="prose flex w-full max-w-full flex-1 flex-col gap-y-3 overflow-hidden">
				<div class="relative flex h-full flex-col overflow-hidden">
					{#if currentStep === 1}
						<ReconcileStep1
							onScan={handleScanIsbn}
							{data}
							onDecrement={handleEditQuantity(-1)}
							onIncrement={handleEditQuantity(1)}
							onContinue={() => (currentStep = 2)}
						/>
					{:else if currentStep > 1}
						<ComparisonTable reconciledBooks={processedOrderDelivery} />
					{/if}

					{#if currentStep > 1}
						<div class="card fixed bottom-4 left-0 z-10 flex w-screen flex-row bg-transparent md:absolute md:bottom-24 md:mx-2 md:w-full">
							<div class="mx-2 flex w-full flex-row justify-between bg-base-300 py-2 shadow-lg">
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
									disabled={data?.reconciliationOrder.finalized}
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
					{/if}
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

<ConfirmDialog
	dialog={deleteDialog}
	title={t.delete_dialog.title()}
	description={t.delete_dialog.description()}
	onConfirm={handleDelete}
	onCancel={() => deleteDialogOpen.set(false)}
	labels={{ confirm: "Confirm", cancel: "Cancel" }}
/>
