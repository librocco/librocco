<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import { superForm, superValidateSync, numberProxy, stringProxy } from "sveltekit-superforms/client";
	import { filter, map, scan, tap } from "rxjs";
	import { fade, fly } from "svelte/transition";
	import { writable, readable } from "svelte/store";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Printer, QrCode, Trash2, FileEdit, MoreVertical, X, Loader2 as Loader, FileCheck } from "lucide-svelte";

	import { goto } from "$lib/utils/navigation";

	import { NoteState, testId, wrapIter, type VolumeStock } from "@librocco/shared";

	import {
		OutOfStockError,
		type BookEntry,
		type NavEntry,
		isCustomItemRow,
		type OutOfStockTransaction,
		NoWarehouseSelectedError
	} from "@librocco/db";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

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
	import type { CustomerOrderLine, InventoryTableData } from "$lib/components/Tables/types";
	import { BookForm, bookSchema, type BookFormOptions, ScannerForm, scannerSchema, customItemSchema } from "$lib/forms";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";
	import { createExtensionAvailabilityStore, settingsStore } from "$lib/stores";

	import { createNoteStores } from "$lib/stores/proto";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";
	import { mergeBookData } from "$lib/utils/misc";

	import type { CustomItemOptions } from "$lib/forms/CustomItemForm.svelte";
	import CustomItemForm from "$lib/forms/CustomItemForm.svelte";
	import { printBookLabel, printReceipt } from "$lib/printer";
	import { Input, Checkbox } from "$lib/components/FormControls";

	import { appPath } from "$lib/paths";
	import CustomerOrderTable from "$lib/components/Tables/OrderTables/CustomerOrderTable.svelte";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const { db } = getDB();

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
	$: loading = !data;
	$: name = `${data.name || ""} ${data.surname || ""}`;
	$: email = data.email;

	$: orderLines = data.orderLines || [];
	const customer = readable(data);

	// #region table
	const tableOptions = writable<{ data: CustomerOrderLine[] }>({
		data: orderLines
			?.slice(0, maxResults)
			// TEMP: remove this when the db is updated
			.map((orderLine) => ({ __kind: "book", ...orderLine }))
	});
	const table = createTable(tableOptions);

	$: tableOptions.set({
		data: (orderLines as CustomerOrderLine[])?.slice(0, maxResults)
	});
	// #endregion table

	const updateRowQuantity = async (e: SubmitEvent, { isbn, quantity: currentQty }: CustomerOrderLine) => {
		const formData = new FormData(e.currentTarget as HTMLFormElement);
		// Number form control validation means this string->number conversion should yield a valid result
		const nextQty = Number(formData.get("quantity"));

		const updatedCustomerOrder = { id: data.id, isbn };
		if (currentQty == nextQty) {
			return;
		}

		/** @TODO wire in when API is implemented */
		// await customerOrder.update(data.id, { quantity: nextQty, ...updatedCustomerOrder });
	};

	const handleAddOrderLine = async (isbn: string) => {
		/**  @TODO: wire in when API is implemented
		 */
		// await customerOrder.addOrderLine({}, { isbn, quantity: 1 });

		// First check if there exists a book entry in the db, if not, fetch book data using external sources
		//
		// Note: this is not terribly efficient, but it's the least ambiguous behaviour to implement
		const [localBookData] = await db.books().get({}, [isbn]);

		// If book data exists and has 'updatedAt' field - this means we've fetched the book data already
		// no need for further action
		if (localBookData?.updatedAt) {
			return;
		}

		// If local book data doesn't exist at all, create an isbn-only entry
		if (!localBookData) {
			await db.books().upsert({}, [{ isbn }]);
		}

		/** @TODO do we need to fetch book data?? */
		// At this point there is a simple (isbn-only) book entry, but we should try and fetch the full book data
		db.plugin("book-fetcher")
			.fetchBookData(isbn)
			.stream()
			.pipe(
				filter((data) => Boolean(data)),
				// Here we're prefering the latest result to be able to observe the updates as they come in
				scan((acc, next) => ({ ...acc, ...next })),
				tap((data) => {
					const { isbn, title } = data;
					// orderLines = [...orderLines, data];
					console.log({ data });
				})
			)
			.subscribe((b) => db.books().upsert({}, [b]));

		console.log();
	};

	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(db);

	$: breadcrumbs = data?.id ? createBreadcrumbs("customers", { id: data.id.toString(), displayName: name }) : [];

	const dialog = createDialog({
		forceVisible: true
	});
	let dialogContent: DialogContent & { type: "commit" | "delete" };

	const {
		elements: { trigger: dialogTrigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = dialog;
</script>

<Page view="customers" loaded={!loading}>
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
		{#if !orderLines?.length}
			<PlaceholderBox title="Enter ISBN" description="Enter ISBN to add books" class="center-absolute">
				<QrCode slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<OrderLineTable {table} editQuantity={updateRowQuantity}>
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
										on:click={() => {}}
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
