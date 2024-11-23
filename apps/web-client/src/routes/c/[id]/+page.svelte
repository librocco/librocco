<script lang="ts">
	import { fade } from "svelte/transition";
	import { type Writable, get, writable, readable } from "svelte/store";
	import { onMount, onDestroy } from "svelte";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults, type SuperForm } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { Printer, QrCode, Trash2, FileEdit, MoreVertical, X, Loader2 as Loader, FileCheck } from "lucide-svelte";

	import { testId } from "@librocco/shared";

	import type { PageData } from "./$types";
	import type { BookEntry } from "@librocco/db";

	import {
		Breadcrumbs,
		PopoverWrapper,
		Page,
		PlaceholderBox,
		createBreadcrumbs,
		Dialog,
		OrderLineTable,
		TextEditable,
		ExtensionAvailabilityToast
	} from "$lib/components";
	import { ScannerForm, scannerSchema } from "$lib/forms";

	import { type DialogContent } from "$lib/dialogs";

	import type { CustomerOrderLine } from "$lib/db/orders/types";
	import { createIntersectionObserver, createTable } from "$lib/actions";
	import { addBooksToCustomer, removeBooksFromCustomer, updateOrderLineQuantity, upsertCustomer } from "$lib/db/orders/customers";
	import { page } from "$app/stores";
	import { invalidate, invalidateAll } from "$app/navigation";

	export let data: PageData;

	const id = parseInt($page.params.id);

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload add customer data dependants when the data changes
		const disposer1 = data.ordersDb.rx.onPoint("customer", BigInt(id), () => invalidate("customer:data"));
		// Reload all customer order line/book data dependants when the data changes
		const disposer2 = data.ordersDb.rx.onRange(["customer_order_lines", "customer_supplier_order"], () => invalidate("customer:books"));

		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll

	$: loading = !data;

	// I see the error of my ways: This is a terrible way to update a persisted value but is necessary for the time being bcs of the way TextEditable operates
	// TODO: replace with form sumission or, at least, an imperative update
	const createFieldStore = <T extends string | number>(init: T, onUpdate: (x: T) => Promise<any> | any): Writable<T> => {
		const internal = writable<T>(init);
		const set = (x: T) => x !== get(internal) && onUpdate(x);
		const update = (cb: (x: T) => T) => onUpdate(cb(get(internal)));
		const subscribe = internal.subscribe.bind(internal);
		return { set, update, subscribe };
	};
	$: name = createFieldStore(data.customerDetails.fullname || "", (fullname) =>
		upsertCustomer(data.ordersDb, { ...data.customerDetails, fullname })
	);
	$: deposit = createFieldStore(data.customerDetails.deposit || 0, (deposit) =>
		upsertCustomer(data.ordersDb, { ...data.customerDetails, deposit: Number(deposit) })
	);
	$: email = createFieldStore(data.customerDetails.email || "", (email) =>
		upsertCustomer(data.ordersDb, { ...data.customerDetails, email })
	);

	$: orderLines = data?.customerBooks;

	// #region table
	const tableOptions = writable<{ data: (CustomerOrderLine & BookEntry)[] }>({
		data: orderLines?.slice(0, maxResults) || []
	});
	const table = createTable(tableOptions);
	$: tableOptions.set({ data: orderLines?.slice(0, maxResults) || [] });
	// #endregion table

	/** @TODO updateQuantity */
	const updateRowQuantity = async (e: SubmitEvent, { isbn, quantity: currentQty, id: bookId }: CustomerOrderLine) => {
		const formData = new FormData(e.currentTarget as HTMLFormElement);

		// Number form control validation means this string->number conversion should yield a valid result
		const nextQty = Number(formData.get("quantity"));
		if (currentQty == nextQty) {
			return;
		}

		await updateOrderLineQuantity(data.ordersDb, bookId, nextQty);
	};

	const handleAddOrderLine = async (isbn: string) => {
		const newBook = {
			isbn,
			quantity: 1,
			id: parseInt($page.params.id),
			created: new Date(),
			/** @TODO provide supplierIds */
			supplierOrderIds: [],
			title: "",
			price: 0
		};
		await addBooksToCustomer(data.ordersDb, parseInt($page.params.id), [newBook]);
	};

	const handleRemoveOrderLine = async (bookId: number) => {
		await removeBooksFromCustomer(data.ordersDb, parseInt($page.params.id), [bookId]);
		open.set(false);
	};

	$: breadcrumbs = id ? createBreadcrumbs("customers", { id: id.toString(), displayName: $name }) : [];

	const dialog = createDialog({
		forceVisible: true
	});
	let dialogContent: DialogContent & { type: "commit" | "delete" };
	const {
		elements: { trigger: dialogTrigger, overlay, portalled },
		states: { open }
	} = dialog;
</script>

<Page view="orders/customers" loaded={!loading}>
	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
	</svelte:fragment>

	<svelte:fragment slot="topbar" let:iconProps>
		<QrCode {...iconProps} />
		<ScannerForm
			data={defaults(zod(scannerSchema))}
			options={{
				SPA: true,
				dataType: "json",
				validators: zod(scannerSchema),
				validationMethod: "submit-only",
				resetForm: true,
				onUpdated: async ({ form }) => {
					const { isbn } = form?.data;
					await handleAddOrderLine(isbn);
				}
			}}
		/>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<div class="flex w-full flex-wrap items-start gap-2">
			<div class="flex max-w-md flex-col">
				<TextEditable
					name="fullname"
					textEl="h1"
					textClassName="text-2xl font-bold leading-7 text-gray-900"
					placeholder="Full Name"
					bind:value={$name}
				/>
				<TextEditable
					name="deposit"
					textEl="h1"
					textClassName="text-2xl font-bold leading-7 text-gray-900"
					placeholder="Deposit"
					bind:value={$deposit}
				/>
				<TextEditable
					name="email"
					textEl="h1"
					textClassName="text-2xl font-bold leading-7 text-gray-900"
					placeholder="Email"
					bind:value={$email}
				/>
			</div>

			<button
				class="mx-2 my-2 rounded-md bg-teal-500 py-[9px] pl-[15px] pr-[17px]"
				on:click={() =>
					upsertCustomer(data.ordersDb, {
						...data.customerDetails,
						fullname: $name,
						email: $email,
						deposit: $deposit
					})}>Save</button
			>
		</div>

		{#if orderLines?.length || $tableOptions.data.length}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<OrderLineTable on:edit-order-line-quantity={({ detail: { event, row } }) => updateRowQuantity(event, row)} {table}>
						<div slot="row-actions" let:row let:rowIx>
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
									<span class="sr-only">Edit row {rowIx}</span>
									<span class="aria-hidden">
										<MoreVertical />
									</span>
								</button>

								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div slot="popover-content" data-testid={testId("popover-container")} class="rounded bg-gray-900">
									<button
										class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
										data-testid={testId("edit-row")}
									>
										<span class="sr-only">Edit row {rowIx}</span>
										<span class="aria-hidden">
											<FileEdit />
										</span>
									</button>

									<button
										use:melt={$dialogTrigger}
										on:m-click={() => {
											dialogContent = {
												onConfirm: () => handleRemoveOrderLine(row.id),
												title: "Delete Book",
												description: "Are you sure you want to delete this book?",
												type: "commit"
											};
										}}
										class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
										data-testid={testId("delete-row")}
									>
										<span class="sr-only">Delete row {rowIx}</span>
										<span class="aria-hidden">
											<Trash2 />
										</span>
									</button>
								</div>
							</PopoverWrapper>
						</div>
					</OrderLineTable>
				</div>

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if orderLines?.length > maxResults}
					<div use:scroll.trigger />
				{/if}
			</div>
		{:else}
			<PlaceholderBox title="Enter ISBN" description="Enter ISBN to add books" class="center-absolute">
				<QrCode slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>

<div use:melt={$portalled}>
	{#if $open}
		{@const { type, title: dialogTitle, description: dialogDescription } = dialogContent}
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}>
			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} {type} onConfirm={dialogContent.onConfirm}>
					<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
					<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>
				</Dialog>
			</div>
		</div>
	{/if}
</div>
