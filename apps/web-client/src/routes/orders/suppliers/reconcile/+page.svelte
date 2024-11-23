<script lang="ts">
	import { ArrowRight, ClockArrowUp, QrCode, Check } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import ComparisonTable from "$lib/components/supplier-orders/ComparisonTable.svelte";
	import CommitDialog from "$lib/components/supplier-orders/CommitDialog.svelte";

	import Page from "$lib/components/Page.svelte";

	import { view } from "@librocco/shared";
	// Mock data for the comparison view
	const mockSupplierBooks = [
		{
			supplier_name: "Academic Books Ltd",
			supplier_id: 1,
			books: [
				{
					isbn: "9781234567897",
					title: "The Art of Learning",
					authors: "Josh Waitzkin",
					price: 15.99,
					delivered: true,
					ordered: 2
				},
				{
					isbn: "9781234567880",
					title: "Deep Work",
					authors: "Cal Newport",
					price: 18.0,
					delivered: false,
					ordered: 1
				}
			]
		},
		{
			supplier_name: "Penguin Random House",
			supplier_id: 2,
			books: [
				{
					isbn: "9780987654321",
					title: "Becoming",
					authors: "Michelle Obama",
					price: 19.5,
					delivered: true,
					ordered: 3
				},
				{
					isbn: "9780987654314",
					title: "Thinking, Fast and Slow",
					authors: "Daniel Kahneman",
					price: 12.99,
					delivered: false,
					ordered: 4
				}
			]
		}
	];

	const reconciliation = {
		id: 123,
		lastUpdated: new Date()
	};

	let isbn = "";
	let books: Array<{
		isbn: string;
		title: string;
		authors: string;
		price: number;
		quantity: number;
	}> = [];

	// Mock supplier orders data
	const selectedOrders = [
		{ id: 1, supplier: "Academic Books Ltd", books: 5 },
		{ id: 2, supplier: "Penguin Random House", books: 3 }
	];

	function handleIsbnSubmit() {
		if (!isbn) return;

		// Mock adding a book
		books = [
			{
				isbn,
				title: "Sample Book",
				authors: "Sample Author",
				price: 19.99,
				quantity: 1
			},
			...books
		];
		isbn = "";
	}

	$: totalDelivered = mockSupplierBooks.reduce((acc, supplier) => acc + supplier.books.filter((b) => b.delivered).length, 0);
	$: totalOrdered = mockSupplierBooks.reduce((acc, supplier) => acc + supplier.books.length, 0);

	let currentStep = 1;
	const commitDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: commitDialogOpen }
	} = commitDialog;

	$: canCompare = books.length > 0;

	function handleCommit() {
		// TODO: Implement actual commit logic
		commitDialogOpen.set(false);
	}
	let initialized = true;
</script>

<Page view={view("orders/suppliers/reconcile")} loaded={initialized}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<header class="navbar mb-4 bg-neutral">
			<input type="checkbox" value="forest" class="theme-controller toggle" />
		</header>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<main class="h-screen">
			<div class="flex h-full flex-col gap-y-10 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
				<div class="min-w-fit md:basis-96 md:overflow-y-auto">
					<div class="card">
						<div class="card-body gap-y-2 p-0">
							<div class="sticky top-0 flex flex-col gap-y-2 bg-base-100 pb-3">
								<h1 class="prose card-title">Reconcile Deliveries</h1>

								<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
									<h2 class="prose">#{reconciliation.id}</h2>

									<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
										<span class="sr-only">Last updated</span>
										<ClockArrowUp size={16} aria-hidden />
										<time dateTime={reconciliation.lastUpdated.toISOString()}>{reconciliation.lastUpdated.toLocaleDateString()}</time>
									</span>
								</div>
							</div>
							<dl class="prose flex flex-col">
								<div class="md:px-1">
									<dt class="mt-0">Includes supplier orders:</dt>
									<div class="flex flex-wrap gap-x-4 md:flex-col">
										{#each selectedOrders as order}
											<dd class="badge-accent badge-outline badge badge-md gap-x-2">
												#{order.id}
												<span class="text-sm font-light">({order.supplier})</span>
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
											on:click={() => (currentStep = step)}
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
											</tr>
										</thead>
										<tbody>
											{#each books as { isbn, title, authors, price }}
												<tr>
													<th>{isbn}</th>
													<td>{title}</td>
													<td>{authors}</td>
													<td>€{price}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						{:else if currentStep > 1}
							<ComparisonTable supplierBooks={mockSupplierBooks} />
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
										on:click={() => {
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
		</main>
	</svelte:fragment>
</Page>
<PageCenterDialog dialog={commitDialog} title="" description="">
	<CommitDialog bookCount={totalDelivered} on:cancel={() => commitDialogOpen.set(false)} on:confirm={handleCommit} />
</PageCenterDialog>
