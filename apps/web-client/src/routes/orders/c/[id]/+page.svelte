<script lang="ts">
	import { QrCode, Mail, ReceiptEuro, UserCircle, ArrowRight, ClockArrowUp, PencilLine } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";

	import { data } from "./data";
	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm, { customerOrderMetaSchema } from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";

	const { customers, customerOrderLines } = data;

	const customerMetaDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: customerMetaDialogOpen }
	} = customerMetaDialog;
</script>

<main class="h-screen">
	<header class="navbar bg-neutral mb-4">
		<input type="checkbox" value="forest" class="toggle theme-controller" />
	</header>

	<div class="max-md:overflow-y-auto flex h-full flex-col gap-y-6 px-4 md:flex-row md:divide-x">
		<div class="min-w-fit basis-full md:basis-96 md:overflow-y-auto">
			<div class="card h-full">
				<div class="card-body gap-y-2 p-0">
					<div class="bg-base-100 sticky top-0 flex flex-col gap-y-2 pb-3">
						<h1 class="card-title prose">Customer Order</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#278123</h2>

							<span class="badge badge-accent badge-outline badge-md gap-x-2 py-2.5">
								<span class="sr-only">Last updated</span>
								<ClockArrowUp size={16} aria-hidden />
								<time dateTime="2023-01-31">January 31, 2023</time>
							</span>
						</div>
					</div>
					<dl class="flex flex-col">
						<div class="border-b py-4 font-bold">
							<dt class="max-md:sr-only">Amount</dt>
							<dd class="mt-1">$10,560.00</dd>
						</div>

						<div class="flex w-full flex-col gap-y-4 py-6">
							<div class="flex w-full flex-wrap justify-between gap-y-4 md:flex-col">
								<div class="max-w-96 flex flex-col gap-y-4">
									<div class="flex  gap-x-3">
										<dt>
											<span class="sr-only">Customer name</span>
											<UserCircle aria-hidden="true" class="h-6 w-5 text-gray-400" />
										</dt>
										<dd class="truncate">Chris De Sousa</dd>
									</div>
									<div class="flex gap-x-3">
										<dt>
											<span class="sr-only">Customer email</span>
											<Mail aria-hidden="true" class="h-6 w-5 text-gray-400" />
										</dt>
										<dd class="truncate">cdelasoul@gmail.com</dd>
									</div>
								</div>
								<div class="flex gap-x-3">
									<dt>
										<span class="sr-only">Deposit</span>
										<ReceiptEuro aria-hidden="true" class="h-6 w-5 text-gray-400" />
									</dt>
									<dd>€30 deposit</dd>
								</div>
							</div>
							<div class="w-full pr-2">
								<button
									class="btn btn-secondary btn-outline btn-xs w-full"
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
						<button class="btn btn-secondary btn-outline btn-sm" type="button" disabled>
							Print receipt
							<ArrowRight aria-hidden size={20} />
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="flex h-full w-full flex-col gap-y-6 md:overflow-y-auto">
			<div class="prose flex w-full max-w-full flex-col gap-y-3 md:px-4">
				<h3 class="max-md:divider max-md:divider-start">Books</h3>
				<label class="input input-bordered flex items-center gap-2">
					<QrCode />
					<input type="text" class="grow" placeholder="Enter ISBN to add books" />
				</label>
			</div>

			<div class="h-full">
				<div class="h-fit">
					<table class="table-pin-rows table">
						<thead>
							<tr>
								<th>ISBN</th>
								<th>Quantity</th>
							</tr>
						</thead>
						<tbody>
							{#each customerOrderLines as { isbn, quantity }}
								<tr>
									<th>{isbn}</th>
									<td>{quantity}</td>
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
		data={defaults(zod(customerOrderMetaSchema))}
		options={{
			SPA: true,
			validators: zod(customerOrderMetaSchema),
			onUpdate: ({ form }) => {
				if (form.valid) {
					// TODO: update data
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
