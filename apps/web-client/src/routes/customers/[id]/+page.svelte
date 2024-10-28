<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import { fade, fly } from "svelte/transition";
	import { writable, readable } from "svelte/store";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Printer, QrCode, Trash2, FileEdit, MoreVertical, X, Loader2 as Loader, FileCheck } from "lucide-svelte";

	import { NoteState, testId, wrapIter, type VolumeStock } from "@librocco/shared";

	import type { PageData } from "./$types";

	import {
		Breadcrumbs,
		DropdownWrapper,
		PopoverWrapper,
		Page,
		PlaceholderBox,
		createBreadcrumbs,
		Dialog,
		OrderLineTable,
		TextEditable,
		type WarehouseChangeDetail,
		ExtensionAvailabilityToast
	} from "$lib/components";
	import { BookForm, bookSchema, type BookFormOptions, ScannerForm, scannerSchema, customItemSchema } from "$lib/forms";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import type { CustomerOrderLine } from "$lib/db/orders/types";
	import { createIntersectionObserver, createTable } from "$lib/actions";
	import { addBooksToCustomer, getCustomerBooks, removeBooksFromCustomer, upsertCustomer } from "$lib/db/orders/customers";
	import { page } from "$app/stores";
	import { invalidate } from "$app/navigation";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.

	/**  @TODO: delete this if not needed (only a few books in table)
	 */
	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll
	//
	const id = $page.params.id;
	$: loading = !data;
	let name = data.customerDetails?.fullname || "";
	let deposit = (data.customerDetails?.deposit || 0).toString() || "";
	let email = data.customerDetails?.email || "";

	$: orderLines = data.customerBooks;

	// #region table
	const tableOptions = writable<{ data: CustomerOrderLine[] }>({
		data: orderLines
			?.slice(0, maxResults)
			// TEMP: remove this when the db is updated
			.map((orderLine) => ({ ...orderLine }))
	});
	$: table = createTable(tableOptions);

	$: tableOptions.set({
		data: (orderLines as CustomerOrderLine[])?.slice(0, maxResults)
	});
	// #endregion table

	/** @TODO updateQuantity */
	// const updateRowQuantity = async (e: SubmitEvent, { isbn, quantity: currentQty }: CustomerOrderLine) => {
	// 	const formData = new FormData(e.currentTarget as HTMLFormElement);
	// 	// Number form control validation means this string->number conversion should yield a valid result
	// 	const nextQty = Number(formData.get("quantity"));

	// 	const updatedCustomerOrder = { id, isbn };
	// 	if (currentQty == nextQty) {
	// 		return;
	// 	}

	// 	await upsertCustomer(data.db,
	//  { ...data.customerDetails, fullname: name, email, deposit: parseInt(deposit) });
	// };

	const handleAddOrderLine = async (isbn: string) => {
		const newBook = {
			isbn,
			quantity: 1,
			id: data.customerDetails.id,
			created: new Date(),
			/** @TODO provide supplierIds */
			supplierOrderIds: []
		};
		await addBooksToCustomer(data.ordersDb, data.customerDetails.id, [newBook]);
		tableOptions.update((prev) => ({ data: [...prev.data, newBook] }));
	};

	const handleRemoveOrderLine = async (bookId: number) => {
		await removeBooksFromCustomer(data.ordersDb, data.customerDetails.id, [bookId]);

		tableOptions.update((prev) => ({ data: [...prev.data.filter((book) => book.id !== bookId)] }));

		open.set(false);
	};

	$: breadcrumbs = id ? createBreadcrumbs("customers", { id: id.toString(), displayName: name }) : [];

	const dialog = createDialog({
		forceVisible: true
	});

	let dialogContent: DialogContent & { type: "commit" | "delete" };

	const {
		elements: { trigger: dialogTrigger, overlay, content, title, description, close, portalled },
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
			data={null}
			options={{
				SPA: true,
				dataType: "json",
				validators: scannerSchema,
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
		<!-- <div class="relative flex max-w-max items-start gap-x-2 p-1"> -->
		<div class="flex flex-col items-start">
			<label class="my-auto text-base font-medium text-gray-800" for="fullname">Full Name</label>
			<input
				class="my-2 mx-1 rounded border-2 border-gray-500 px-2 py-1.5 focus:border-teal-500 focus:ring-0"
				id="fullname"
				name="fullname"
				bind:value={name}
				placeholder="Full Name"
			/>

			<label class="my-auto text-base font-medium text-gray-800" for="deposit"> Deposit</label>
			<input
				class="my-2 mx-1 rounded border-2 border-gray-500 px-2 py-1.5 focus:border-teal-500 focus:ring-0"
				id="deposit"
				name="deposit"
				bind:value={deposit}
				placeholder="Deposit"
			/>

			<label class="my-auto text-base font-medium text-gray-800" for="email">Email</label>
			<input
				class="my-2 mx-1 rounded border-2 border-gray-500 px-2 py-1.5 focus:border-teal-500 focus:ring-0"
				id="email"
				name="email"
				bind:value={email}
				placeholder="Email"
			/>
			<button
				class="my-2 mx-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
				on:click={() => upsertCustomer(data.ordersDb, { ...data.customerDetails, fullname: name, email, deposit: parseInt(deposit) })}
				>save</button
			>
		</div>
		<!-- </div> -->
		{#if orderLines?.length || $tableOptions.data.length}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<OrderLineTable {table}>
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
