<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import {
		BookUp,
		QrCode,
		X,
		Trash2,
		Mail,
		FileEdit,
		ReceiptEuro,
		UserCircle,
		MoreVertical,
		ArrowRight,
		ClockArrowUp,
		PencilLine
	} from "lucide-svelte";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults, superForm, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { page } from "$app/stores";
	import { invalidate } from "$app/navigation";
	import { fade, fly } from "svelte/transition";

	import { stripNulls } from "@librocco/shared";

	import { PopoverWrapper, Dialog } from "$lib/components";

	import { getCustomerOrderLines } from "$lib/db/cr-sqlite/customers";
	import type { Customer } from "$lib/db/cr-sqlite/types";
	import type { PageData } from "./$types";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import { testId } from "@librocco/shared";

	import { createExtensionAvailabilityStore } from "$lib/stores";
	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { DaisyUIBookForm, bookSchema, createCustomerOrderSchema, type BookFormSchema } from "$lib/forms";
	import ConfirmDialog from "$lib/components/Dialogs/ConfirmDialog.svelte";

	import { getOrderLineStatus } from "$lib/utils/order-status";

	import {
		addBooksToCustomer,
		removeBooksFromCustomer,
		isDisplayIdUnique,
		upsertCustomer,
		markCustomerOrderLineAsCollected
	} from "$lib/db/cr-sqlite/customers";
	import type { BookEntry } from "@librocco/db";

	import { upsertBook } from "$lib/db/cr-sqlite/books";

	import { scannerSchema } from "$lib/forms/schemas";

	import { mergeBookData } from "$lib/utils/misc";

	// import { createIntersectionObserver } from "$lib/actions";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;

	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload add customer data dependants when the data changes
		const disposer1 = rx.onPoint("customer", BigInt(customerId), () => invalidate("customer:data"));
		// Reload all customer order line/book data dependants when the data changes
		const disposer2 = rx.onRange(["customer_order_lines"], () => invalidate("customer:books"));
		disposer = () => (disposer1(), disposer2());
	});

	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	// #endregion reactivity

	$: customerId = parseInt($page.params.id);

	$: db = data.dbCtx?.db;

	$: customer = data?.customer;
	$: customerOrderLines = data?.customerOrderLines || [];
	$: publisherList = data.publisherList;

	$: totalAmount = customerOrderLines?.reduce((acc, cur) => acc + cur.price, 0) || 0;

	$: plugins = data.plugins;
	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(plugins);

	// #region infinite-scroll
	// let maxResults = 20;
	// // Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	// const seeMore = () => (maxResults += 20);
	// // We're using in intersection observer to create an infinite scroll effect
	// const scroll = createIntersectionObserver(seeMore);

	// #endregion infinite-scroll

	// #region dialog
	const customerMetaDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: customerMetaDialogOpen }
	} = customerMetaDialog;

	const handleUpdateCustomer = async (_data: Partial<Customer>) => {
		const data = { ...stripNulls(customer), ..._data };

		if (!(await isDisplayIdUnique(db, data))) {
			return handleOpenNonUniqueIdDialog(data);
		}

		await upsertCustomer(db, data);
	};

	const nonUniqueIdDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: nonUniqueIdDialogOpen }
	} = nonUniqueIdDialog;
	let submittingCustomer: Customer | null = null;

	const nonUniqueIdDialogHeading = "Non unique customer ID";
	const nonUniqueIdDialogDescription = "There's at least one more order with the same ID. Please confirm you're ok with this?";

	const handleOpenNonUniqueIdDialog = (data: Customer) => {
		submittingCustomer = data;
		nonUniqueIdDialogOpen.set(true);
	};

	const handleConfirmNonUniqueIdDialog = async () => {
		await upsertCustomer(db, submittingCustomer);
		submittingCustomer = null;
		nonUniqueIdDialogOpen.set(false);
	};

	// #endregion dialog

	const handleDeleteLine = async (lineId) => {
		await removeBooksFromCustomer(db, customerId, [lineId]);
	};
	const handleCollect = async (id: number) => {
		await markCustomerOrderLineAsCollected(db, id);
	};

	// #region book-form
	let bookFormData = null;

	const onUpdated: SuperForm<BookFormSchema>["options"]["onUpdated"] = async ({ form }) => {
		/**
		 * This is a quick fix for `form.data` having all optional properties
		 *
		 * Unforuntately, Zod will not infer the correct `data` type from our schema unless we configure `strictNullChecks: true` in our TS config.
		 * Doing so however raises a mountain of "... potentially undefined" type errors throughout the codebase. It will take a significant amount of work
		 * to fix these properly.
		 *
		 * It is still safe to assume that the required properties of BookEntry are there, as the relative form controls are required
		 */
		const data = form?.data as BookEntry;

		try {
			await upsertBook(db, data);
			bookFormData = null;
			customerOrderLines = await getCustomerOrderLines(db, Number(customerId));
			open.set(false);
		} catch (err) {
			// toastError(`Error: ${err.message}`);
		}
	};

	let scanInputRef: HTMLInputElement = null;

	// TODO: We reuse the ScannerForm and setup across a few pages => good candidate for a component...
	// It already exists as one but not with the new skin
	const { form: formStore, enhance } = superForm(defaults(zod(scannerSchema)), {
		SPA: true,
		validators: zod(scannerSchema),
		validationMethod: "submit-only",
		onUpdate: async ({ form: { data, valid } }) => {
			// scannerSchema defines isbn minLength as 1, so it will be invalid if "" is entered
			if (valid) {
				const { isbn } = data;

				await addBooksToCustomer(db, customerId, [isbn]);
			}
		},
		onUpdated: ({ form: { valid } }) => {
			if (valid) {
				scanInputRef?.focus();
			}
		}
	});

	const dialog = createDialog({
		forceVisible: true
	});
	const {
		elements: { trigger: dialogTrigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = dialog;

	let dialogContent: DialogContent & { type: "delete" | "edit-row" };
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
								<time dateTime={data?.customer?.updatedAt ? new Date(data?.customer?.updatedAt).toISOString() : ""}
									>{new Date(data?.customer?.updatedAt || "").toLocaleString()}</time
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
										<dd class="truncate">{data?.customer?.fullname || ""}</dd>
									</div>
									<div class="flex gap-x-3">
										<dt>
											<span class="sr-only">Customer email</span>
											<Mail aria-hidden="true" class="h-6 w-5 text-gray-400" />
										</dt>
										<dd class="truncate">{data?.customer?.email || ""}</dd>
									</div>
								</div>
								<div class="flex gap-x-3">
									<dt>
										<span class="sr-only">Deposit</span>
										<ReceiptEuro aria-hidden="true" class="h-6 w-5 text-gray-400" />
									</dt>
									<dd>€{data?.customer?.deposit || 0} deposit</dd>
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
				<form class="flex w-full gap-2" use:enhance method="POST">
					<label class="input-bordered input flex flex-1 items-center gap-2">
						<QrCode />
						<input
							type="text"
							class="grow"
							bind:value={$formStore.isbn}
							placeholder="Enter ISBN of delivered books"
							required
							bind:this={scanInputRef}
						/>
					</label>
				</form>
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
								<th>Status</th>
								<th>Collected</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each customerOrderLines as { id, isbn, title, authors, publisher, price, year, editedBy, outOfPrint, category, placed, received, collected }}
								{@const placedTime = placed?.getTime()}
								{@const receivedTime = received?.getTime()}
								{@const collectedTime = collected?.getTime()}
								{@const orderLineStatus = getOrderLineStatus({ placed: placedTime, received: receivedTime, collected: collectedTime })}

								<tr>
									<th>{isbn}</th>
									<td>{title}</td>
									<td>{authors}</td>
									<td>{price}</td>
									<td>
										{#if orderLineStatus === "collected"}
											<span class="badge-success badge">Collected</span>
										{:else if orderLineStatus === "received"}
											<span class="badge-info badge">Delivered</span>
										{:else if orderLineStatus === "placed"}
											<span class="badge-warning badge">Placed</span>
										{:else}
											<span class="badge">Draft</span>
										{/if}
									</td>
									<td>
										{#if orderLineStatus === "collected"}
											<!--
												NOTE: using ISO date here as this is a WIP, and it avoids ambiguity in E2E test difference of env.
												TODO: use some more robust way to handle this (loacle time string that actually works)
											-->
											{collected.toISOString().slice(0, 10)}
										{/if}
									</td>
									<td>
										<PopoverWrapper
											options={{
												forceVisible: true,
												positioning: {
													placement: "left"
												}
											}}
											let:trigger
										>
											<button
												data-testid={testId("popover-control")}
												{...trigger}
												use:trigger.action
												class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
											>
												<span class="sr-only">Edit line</span>
												<span class="aria-hidden">
													<MoreVertical />
												</span>
											</button>
											<div slot="popover-content" data-testid={testId("popover-container")} class="rounded bg-gray-900">
												<button
													use:melt={$dialogTrigger}
													class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
													data-testid={testId("edit-row")}
													on:m-click={() => {
														bookFormData = { isbn, title, authors, publisher, price, year, editedBy, outOfPrint, category };
														dialogContent = {
															onConfirm: () => {},
															title: dialogTitle.editBook(),
															description: dialogDescription.editBook(),
															type: "edit-row"
														};
													}}
													on:m-keydown={() => {
														bookFormData = { isbn, title, authors, publisher, price, year, editedBy, outOfPrint, category };

														dialogContent = {
															onConfirm: () => {},
															title: dialogTitle.editBook(),
															description: dialogDescription.editBook(),
															type: "edit-row"
														};
													}}
												>
													<span class="sr-only">Edit row</span>
													<span class="aria-hidden">
														<FileEdit />
													</span>
												</button>

												{#if orderLineStatus === "received"}
													<button
														class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
														on:click={() => handleCollect(id)}
													>
														<span class="sr-only">Collect</span>
														<span class="aria-hidden">
															<BookUp />
														</span>
													</button>
												{:else if orderLineStatus === "draft"}
													<button
														class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
														data-testid={testId("delete-row")}
														on:click={() => handleDeleteLine(id)}
													>
														<span class="sr-only">Delete row</span>
														<span class="aria-hidden">
															<Trash2 />
														</span>
													</button>
												{/if}
											</div>
										</PopoverWrapper>
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

<div use:melt={$portalled}>
	{#if $open}
		{@const { type, onConfirm, title: dialogTitle, description: dialogDescription } = dialogContent}

		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}></div>
		{#if type === "edit-row"}
			<div
				use:melt={$content}
				class="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 overflow-y-auto
				bg-white shadow-lg focus:outline-none"
				in:fly|global={{
					x: 350,
					duration: 150,
					opacity: 1
				}}
				out:fly|global={{
					x: 350,
					duration: 100
				}}
			>
				<div class="flex w-full flex-row justify-between bg-gray-50 px-6 py-4">
					<div>
						<h2 use:melt={$title} class="mb-0 text-lg font-medium text-black">{dialogTitle}</h2>
						<p use:melt={$description} class="mb-5 mt-2 leading-normal text-zinc-600">{dialogDescription}</p>
					</div>
					<button use:melt={$close} aria-label="Close" class="self-start rounded p-3 text-gray-500 hover:text-gray-900">
						<X class="square-4" />
					</button>
				</div>
				<div class="px-6">
					<!-- {$connectivity} -->
					<DaisyUIBookForm
						data={defaults(bookFormData, zod(bookSchema))}
						{publisherList}
						options={{
							SPA: true,
							dataType: "json",
							validators: zod(bookSchema),
							validationMethod: "submit-only",
							onUpdated
						}}
						onCancel={() => open.set(false)}
						onFetch={async (isbn, form) => {
							const results = await plugins.get("book-fetcher").fetchBookData(isbn, { retryIfAlreadyAttempted: true }).all();

							// Entries from (potentially) multiple sources for the same book (the only one requested in this case)
							const bookData = mergeBookData({ isbn }, results);

							// If there's no book was retrieved from any of the sources, exit early
							if (!bookData) {
								return;
							}

							form.update((data) => ({ ...data, ...bookData }));
							// TODO: handle loading and errors
						}}
						isExtensionAvailable={$bookDataExtensionAvailable}
					/>
				</div>
			</div>
		{:else}
			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} {type} {onConfirm}>
					<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
					<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>
				</Dialog>
			</div>
		{/if}
	{/if}
</div>

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
				if (form.valid) {
					handleUpdateCustomer(form.data);
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

<PageCenterDialog dialog={nonUniqueIdDialog} title="" description="">
	<ConfirmDialog
		on:confirm={handleConfirmNonUniqueIdDialog}
		on:cancel={() => nonUniqueIdDialogOpen.set(false)}
		heading={nonUniqueIdDialogHeading}
		description={nonUniqueIdDialogDescription}
		labels={{ confirm: "Confirm", cancel: "Cancel" }}
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
