<script lang="ts">
	import { ArrowRight, Check, ClockArrowUp, QrCode } from "lucide-svelte";

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
									<dd class="badge badge-accent badge-outline badge-md gap-x-2">
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
						<li class="flex-grow">
							<button class="flex w-full items-center gap-x-2 px-4 py-2 text-sm">
								<span class="bg-primary flex shrink-0 items-center justify-center rounded-full p-1">
									<Check aria-hidden="true" class="text-white" size={22} />
								</span>
								<span class="inline-flex flex-col items-start">
									<span class="font-medium">Populate</span>
									<span class="font-light max-md:sr-only">Delivered books</span>
								</span>
							</button>
						</li>

						<li class="flex-grow">
							<button aria-current="step" class="text-primary flex items-center gap-x-2 px-4 py-2 text-sm" disabled>
								<span class="border-primary flex shrink-0 items-center justify-center rounded-full border-2 px-2.5 py-1">
									<span>2</span>
								</span>
								<span class="inline-flex flex-col items-start text-start">
									<span class="font-medium">Compare</span>
									<span class="font-light max-md:sr-only">To ordered</span>
								</span>
							</button>
						</li>

						<li class="flex-grow">
							<button class="text-primary/50 flex items-center gap-x-2 px-4 py-2 text-sm">
								<span class="border-primary/50 flex shrink-0 items-center justify-center rounded-full border-2 px-2.5 py-1">
									<span>3</span>
								</span>
								<span class="flex flex-col items-start text-start">
									<span class="font-medium">Commit</span>
									<span class="font-light max-md:sr-only">Notify customers</span>
								</span>
							</button>
						</li>
					</ol>
				</nav>

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
						{#if true}
							<div class="card fixed bottom-4 left-0 z-10 flex w-screen flex-row bg-transparent md:absolute md:bottom-24 md:mx-2 md:w-full">
								<div class="bg-base-300 mx-2 flex w-full flex-row justify-end px-4 py-2 shadow-lg">
									<button class="btn-primary btn self-end" on:click={() => {}}>
										Next step
										<ArrowRight aria-hidden size={20} class="hidden md:block" />
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>
