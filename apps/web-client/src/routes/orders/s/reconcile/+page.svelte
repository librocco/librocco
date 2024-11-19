<script lang="ts">
	import { ArrowRight, ClockArrowUp, QrCode } from "lucide-svelte";

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

	let step = 1;
	$: canReconcile = books.length > 0;
</script>

<main class="h-screen">
	<header class="navbar bg-neutral mb-4">
		<input type="checkbox" value="forest" class="theme-controller toggle" />
	</header>

	<div class="flex h-full flex-col gap-y-10 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="min-w-fit md:basis-96 md:overflow-y-auto">
			<div class="card">
				<div class="card-body gap-y-2 p-0">
					<div class="bg-base-100 sticky top-0 flex flex-col gap-y-2 pb-3">
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
									<dd class="my-0.5 pl-2">
										#{order.id}
										<span class="text-sm">({order.supplier})</span>
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
				<div class="flex items-center justify-between">
					<h3 class="max-md:divider-start max-md:divider m-0">
						<span class="opacity-50">Step {step}:</span>
						{#if step === 1}
							Add delivered books
						{:else}
							Compare
						{/if}
					</h3>
					<button class="btn-primary btn-md btn" disabled={!canReconcile} on:click={() => (step = 2)}>
						{#if step === 1}
							Compare
						{:else}
							Finalise
						{/if}
						<ArrowRight aria-hidden size={20} />
					</button>
				</div>

				<form class="flex w-full gap-2" on:submit|preventDefault={handleIsbnSubmit}>
					<label class="input-bordered input flex flex-1 items-center gap-2">
						<QrCode />
						<input type="text" class="grow" placeholder="Enter ISBN of delivered books" bind:value={isbn} />
					</label>
				</form>
			</div>

			<div class="relative h-full overflow-x-auto">
				{#if books.length === 0}
					<div class="border-base-300 flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed p-6">
						<p class="text-base-content/70 text-center">Scan or enter the ISBNs of the delivered books to begin reconciliation.</p>
					</div>
				{:else}
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
							{#each books as { isbn, title, authors, price, quantity }}
								<tr>
									<th>{isbn}</th>
									<td>{title}</td>
									<td>{authors}</td>
									<td>€{price}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>
	</div>
</main>
