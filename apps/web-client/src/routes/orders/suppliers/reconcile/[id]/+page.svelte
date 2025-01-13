<script lang="ts">
	import { ArrowRight, ClockArrowUp, QrCode, Check } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import ComparisonTable from "$lib/components/supplier-orders/ComparisonTable.svelte";
	import CommitDialog from "$lib/components/supplier-orders/CommitDialog.svelte";

	import Page from "$lib/components/Page.svelte";
	import type { PageData } from "./$types";
	import { addOrderLinesToReconciliationOrder, finalizeReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { page } from "$app/stores";
	import { onDestroy, onMount } from "svelte";
	import { invalidate } from "$app/navigation";
	import { processOrderDelivery } from "$lib/db/cr-sqlite/utils";

	// implement order reactivity/sync
	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: ordersDbCtx should always be defined on client
		const { rx } = data.dbCtx;

		const disposer1 = rx.onPoint("reconciliationOrder", BigInt($page.params.id), () => invalidate("reconciliationOrder:data"));
		const disposer2 = rx.onRange(["reconciliation_order"], () => invalidate("reconciliationOrder:data"));
		disposer = () => (disposer1(), disposer2());
	});

	//#endregion reactivity

	onDestroy(async () => {
		// Unsubscribe on unmount
		disposer();
		if (timeout) {
			clearTimeout(timeout);
			await addOrderLinesToReconciliationOrder(data.ordersDb, parseInt($page.params.id), isbns);
		}
	});
	let isbn = "";
	let books: Array<{
		isbn: string;
		title: string;
		authors: string;
		price: number;
		quantity: number;
	}> = data?.mergedBookData || [];

	let timeout = null;
	let isbns = JSON.parse(data?.reconciliationOrder.customer_order_line_ids) || [];
	// Mock supplier orders data

	$: scanned = data?.placedOrderLines;

	async function finalizeScanning() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
			await addOrderLinesToReconciliationOrder(data.ordersDb, parseInt($page.params.id), isbns);
		}
	}
	function handleIsbnSubmit() {
		if (!isbn) return;
		isbns = [...isbns, isbn];

		books = [
			{
				isbn,
				title: "",
				authors: "",
				price: 0,
				quantity: 1
			},
			...books
		];

		//invocation is debounced to 10 seconds from first call
		if (!timeout) {
			timeout = setTimeout(async () => {
				await addOrderLinesToReconciliationOrder(data.ordersDb, parseInt($page.params.id), isbns);
				timeout = null;
			}, 10000);
		}

		isbn = "";
	}

	$: placedOrderLines = data?.placedOrderLines;
	$: totalDelivered = data?.mergedBookData.length;
	// mockSupplierBooks.reduce((acc, supplier) => acc + supplier.books.filter((b) => b.delivered).length, 0);
	$: totalOrdered = placedOrderLines.length;
	$: processedOrderDelivery = processOrderDelivery(data?.mergedBookData, data?.placedOrderLines);

	let currentStep = 1;
	const commitDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: commitDialogOpen }
	} = commitDialog;

	$: canCompare = books.length > 0;

	async function handleCommit() {
		// TODO: Implement actual commit logic
		commitDialogOpen.set(false);
		await finalizeReconciliationOrder(data?.ordersDb, parseInt($page.params.id));
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
						<h1 class="prose card-title">Reconcile Deliveries</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{data?.reconciliationOrder.id}</h2>

							<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
								<span class="sr-only">Last updated</span>
								<ClockArrowUp size={16} aria-hidden />
								<!-- <time dateTime={data?.reconciliationOrder.created.toISOString()}
									>{data?.reconciliationOrder.created.toLocaleDateString()}</time
								> -->
							</span>
						</div>
					</div>
					<dl class="prose flex flex-col">
						<div class="md:px-1">
							<dt class="mt-0">Includes supplier orders:</dt>
							<div class="flex flex-wrap gap-x-4 md:flex-col">
								{#each Object.entries(data?.supplierOrders) as [supplierOrderId, { supplier_name, supplier_id }], i}
									<dd class="badge-accent badge-outline badge badge-md gap-x-2">
										#{supplierOrderId}
										<span class="text-sm font-light">({supplier_name})</span>
									</dd>
								{/each}
							</div>
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
										if (step === 2) {
											await finalizeScanning();
										}
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
					<form class="flex w-full gap-2" on:submit|preventDefault={handleIsbnSubmit}>
						<label class="input-bordered input flex flex-1 items-center gap-2">
							<QrCode />
							<input type="text" class="grow" placeholder="Enter ISBN of delivered books" bind:value={isbn} />
						</label>
					</form>
				{/if}
			</div>
			<div class="relative h-full overflow-x-auto">
				{#if currentStep === 1}
					{#if books.length === 0}
						<div class="flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-base-300 p-6">
							<p class="text-center text-base-content/70">Scan or enter the ISBNs of the delivered books to begin reconciliation.</p>
						</div>
					{:else}
						<div class="relative h-full overflow-x-auto">
							<table class="table-pin-rows table pb-20">
								<thead>
									<tr>
										<th>ISBN</th>
										<th>Title</th>
										<th>Authors</th>
										<th>Price</th>
										<th>Quantity</th>
									</tr>
								</thead>
								<tbody>
									{#each books as { isbn, title, authors, price, quantity }}
										<tr>
											<th>{isbn}</th>
											<td>{title}</td>
											<td>{authors}</td>
											<td>€{price}</td>
											<td>{quantity}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{:else if currentStep > 1}
					<ComparisonTable supplierBooks={processedOrderDelivery} />
				{/if}

				{#if canCompare || currentStep > 1}
					<div class="card fixed bottom-4 left-0 z-10 flex w-screen flex-row bg-transparent md:absolute md:bottom-24 md:mx-2 md:w-full">
						<div class="mx-2 flex w-full flex-row justify-between bg-base-300 px-4 py-2 shadow-lg">
							{#if currentStep > 1}
								<dl class="stats flex">
									<div class="stat flex shrink flex-row place-items-center py-2 max-md:px-4">
										<dt class="stat-title">Total delivered:</dt>
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
										await finalizeScanning();
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
</main>

<PageCenterDialog dialog={commitDialog} title="" description="">
	<CommitDialog bookCount={totalDelivered} on:cancel={() => commitDialogOpen.set(false)} on:confirm={handleCommit} />
</PageCenterDialog>
