<script lang="ts">
	import { QrCode, Mail, ReceiptEuro, UserCircle, ArrowRight, ClockArrowUp, PencilLine } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";

	import { stripNulls } from "@librocco/shared";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema } from "$lib/forms";

	import { getOrderLineStatus } from "$lib/utils/order-status";
	import type { PageData } from "./$types";
	import { page } from "$app/stores";
	import { addBooksToCustomer, upsertCustomer } from "$lib/db/cr-sqlite/customers";
	import { onDestroy, onMount } from "svelte";
	import { invalidate } from "$app/navigation";
	import { writable } from "svelte/store";
	import type { CustomerOrderLine } from "$lib/db/cr-sqlite/types";
	import type { BookEntry } from "@librocco/db";
	// import { createIntersectionObserver } from "$lib/actions";

	export let data: PageData;

	$: customer = data.customer;

	const id = parseInt($page.params.id);
	let currentBookISBN = "";

	// #region infinite-scroll
	let maxResults = 20;
	// // Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	// const seeMore = () => (maxResults += 20);
	// // We're using in intersection observer to create an infinite scroll effect
	// const scroll = createIntersectionObserver(seeMore);

	// #endregion infinite-scroll
	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: ordersDbCtx should always be defined on client
		const { rx } = data.ordersDbCtx;

		// Reload add customer data dependants when the data changes
		const disposer1 = rx.onPoint("customer", BigInt(id), () => invalidate("customer:data"));
		// Reload all customer order line/book data dependants when the data changes
		const disposer2 = rx.onRange(["customer_order_lines", "customer_supplier_order"], () => invalidate("customer:books"));
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});

	$: db = data.ordersDbCtx?.db;

	$: orderLines = data?.customerOrderLines.filter((line) => line.customer_id.toString() === $page.params.id);
	const lines = writable<{ data: (CustomerOrderLine & BookEntry)[] }>({
		data: orderLines?.slice(0, maxResults) || []
	});
	$: lines.set({ data: orderLines?.slice(0, maxResults) || [] });
	$: totalAmount = orderLines?.reduce((acc, cur) => acc + cur.price, 0) || 0;
	// #endregion reactivity
	// #region dialog

	const customerMetaDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: customerMetaDialogOpen }
	} = customerMetaDialog;

	// #endregion dialog
	const handleAddOrderLine = async (isbn: string) => {
		const newBook = {
			isbn,
			/** @TODO remove quantity from bookLine */
			quantity: 1,
			id: parseInt($page.params.id),
			created: new Date(),
			/** @TODO provide supplierIds */
			supplierOrderIds: [],
			title: "",
			price: 0
		};

		await addBooksToCustomer(db, parseInt($page.params.id), [newBook]);
		currentBookISBN = "";
	};
</script>

<header class="navbar mb-4 bg-neutral">
	<input type="checkbox" value="forest" class="theme-controller toggle" />
</header>

<main class="h-screen">
	<div class="flex h-full flex-col gap-y-10 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="min-w-fit md:basis-96 md:overflow-y-auto">
			<div class="card h-full">
				<div class="card-body gap-y-2 p-0">
					<div class="sticky top-0 flex flex-col gap-y-2 bg-base-100 pb-3">
						<h1 class="prose card-title">Customer Order</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{customer.displayId}</h2>

							<span class="badge-accent badge-outline badge badge-md gap-x-2 py-2.5">
								<span class="sr-only">Last updated</span>
								<ClockArrowUp size={16} aria-hidden />
								<time dateTime={data?.customer.updatedAt ? new Date(data.customer.updatedAt).toISOString() : ""}
									>{new Date(data?.customer.updatedAt).toLocaleString()}</time
								>
							</span>
						</div>
					</div>
					<dl class="flex flex-col">
						<div class="border-b py-4 font-bold">
							<dt class="max-md:sr-only">Total amount</dt>
							<dd class="mt-1">€{totalAmount}</dd>
						</div>

						<div class="flex w-full flex-col gap-y-4 py-6">
							<div class="flex w-full flex-wrap justify-between gap-y-4 md:flex-col">
								<div class="max-w-96 flex flex-col gap-y-4">
									<div class="flex gap-x-3">
										<dt>
											<span class="sr-only">Customer name</span>
											<UserCircle aria-hidden="true" class="h-6 w-5 text-gray-400" />
										</dt>
										<dd class="truncate">{data?.customer.fullname || ""}</dd>
									</div>
									<div class="flex gap-x-3">
										<dt>
											<span class="sr-only">Customer email</span>
											<Mail aria-hidden="true" class="h-6 w-5 text-gray-400" />
										</dt>
										<dd class="truncate">{data?.customer.email || ""}</dd>
									</div>
								</div>
								<div class="flex gap-x-3">
									<dt>
										<span class="sr-only">Deposit</span>
										<ReceiptEuro aria-hidden="true" class="h-6 w-5 text-gray-400" />
									</dt>
									<dd>€{data?.customer.deposit || 0} deposit</dd>
								</div>
							</div>
							<div class="w-full pr-2">
								<button
									class="btn-secondary btn-outline btn-xs btn w-full"
									type="button"
									aria-label="Edit customer order name, email or deposit"
									on:click={() => customerMetaDialogOpen.set(true)}
								>
									<PencilLine aria-hidden size={16} />
								</button>
							</div>
						</div>
					</dl>
					<div class="card-actions border-t py-6 md:mb-20">
						<button class="btn-secondary btn-outline btn-sm btn" type="button" disabled>
							Print receipt
							<ArrowRight aria-hidden size={20} />
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="mb-20 flex h-full w-full flex-col gap-y-6 md:overflow-y-auto">
			<div class="prose flex w-full max-w-full flex-col gap-y-3 md:px-4">
				<h3 class="max-md:divider-start max-md:divider">Books</h3>
				<label class="input-bordered input flex items-center gap-2">
					<QrCode />
					<input
						type="text"
						class="grow"
						bind:value={currentBookISBN}
						on:keydown={(e) => (e.key === "Enter" ? handleAddOrderLine(currentBookISBN) : null)}
						placeholder="Enter ISBN to add books"
					/>
				</label>
			</div>

			<div class="h-full overflow-x-auto">
				<div class="h-full">
					<table class="table-pin-rows table">
						<thead>
							<tr>
								<th>ISBN</th>
								<th>Title</th>
								<th>Authors</th>
								<th>Price</th>
								<th>Quantity</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each $lines.data as { isbn, title, authors, price, placed, received, collected }}
								{@const placedTime = placed?.getTime()}
								{@const receivedTime = received?.getTime()}
								{@const collectedTime = collected?.getTime()}

								<tr>
									<th>{isbn}</th>
									<td>{title}</td>
									<td>{authors}</td>
									<td>{price}</td>
									<td>
										{#if getOrderLineStatus({ placed: placedTime, received: receivedTime, collected: collectedTime }) === "collected"}
											<span class="badge-success badge">Collected</span>
										{:else if getOrderLineStatus({ placed: placedTime, received: receivedTime, collected: collectedTime }) === "received"}
											<span class="badge-info badge">Received</span>
										{:else if getOrderLineStatus({ placed: placedTime, received: receivedTime, collected: collectedTime }) === "placed"}
											<span class="badge-warning badge">Placed</span>
										{:else}
											<span class="badge">Draft</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</main>

<PageCenterDialog dialog={customerMetaDialog} title="" description="">
	<CustomerOrderMetaForm
		heading="Update customer details"
		saveLabel="Update"
		kind="update"
		data={defaults(stripNulls(customer), zod(createCustomerOrderSchema("update")))}
		options={{
			SPA: true,
			validators: zod(createCustomerOrderSchema("update")),
			onUpdate: ({ form }) => {
				console.log("data:", form.data);
				console.log("valid:", form.valid);
				if (form.valid) {
					upsertCustomer(db, { ...stripNulls(customer), ...form.data, id });
				}
			},
			onUpdated: async ({ form }) => {
				if (form.valid) {
					customerMetaDialogOpen.set(false);
				}
			}
		}}
		onCancel={() => customerMetaDialogOpen.set(false)}
	/>
</PageCenterDialog>

<style global>
	:global(html) {
		overflow-x: hidden;
		height: 100%;
		margin-right: calc(-1 * (100vw - 100%));
	}

	:global(body) {
		height: 100%;
		padding: 0;
	}
</style>
