<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Plus, Search, Trash, Loader2 as Loader, Library, PersonStanding, MoreVertical, Trash2, FileEdit } from "lucide-svelte";
	import { firstValueFrom, map } from "rxjs";

	import { goto } from "$lib/utils/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import { getDB } from "$lib/db";

	import { Page, PlaceholderBox, Dialog, ExtensionAvailabilityToast, CustomerOrderTable } from "$lib/components";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import type { CustomerOrderData } from "$lib/components/Tables/types";
	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";
	import { PopoverWrapper } from "$lib/components";
	import { compareNotes } from "$lib/utils/misc";

	import { appPath } from "$lib/paths";
	import { readable, writable } from "svelte/store";
	import { Observable, from } from "rxjs";
	import { v4 } from "uuid";

	import { createTable, createIntersectionObserver } from "$lib/actions";
	const { db, status } = getDB();

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll
	//
	//
	const customersCtx = { name: "[CUSTOMERS_LIST]", debug: false };
	const customerData = [
		{ name: "Fadwa", surname: "Mahmoud", id: 1234, email: "fadwa.mahmoud@gmail.com" },
		{ name: "Not Fadwa", surname: "Mahmoud", id: 112234, email: "not.fadwa.mahmoud@gmail.com" }
	];
	const customersPromise = new Promise<{ name: string; surname: string; id: number; email: string }[]>((resolve) =>
		setTimeout(() => {
			resolve(customerData);
		}, 500)
	);
	const customerStream = from(customersPromise);

	const customerOrdersList = readable(customerData);

	// const customerOrdersList = readableFromStream(customersCtx, customerStream, []);

	const tableOptions = writable<{ data: CustomerOrderData[] }>({
		data: customerData
	});
	const table = createTable(tableOptions);

	$: tableOptions.set({
		data: (customerData as CustomerOrderData[])?.slice(0, maxResults)
	});
	const dialog = createDialog({
		forceVisible: true
	});
	let dialogContent: DialogContent & { type: "commit" | "delete" };

	const {
		elements: { trigger: dialogTrigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = dialog;

	const deleteRow = async (rowIx: number) => {
		/** @TODO delete customer order API endpoint */
		console.log("customer order not deleted");
	};
	let initialized = true;
</script>

<Page view="customers" loaded={initialized}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">Customer Orders</h1>
			<button
				on:click={() => {
					goto(appPath("customers", v4()));
				}}
				class="flex items-center gap-2 rounded-md border border-gray-300 bg-white py-[9px] pl-[15px] pr-[17px]"
			>
				<span><Plus size={20} /></span>
				<span class="text-sm font-medium leading-5 text-gray-700">New Customer Order</span>
			</button>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if !initialized}
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else}
			<!-- Start entity list contaier -->

			<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
			<div>
				<CustomerOrderTable {table}>
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
									on:click={() => {
										goto(appPath("customers", `${row.id}`));
									}}
								>
									<span class="sr-only">Edit row {rowIx}</span>
									<span class="aria-hidden">
										<FileEdit />
									</span>
								</button>

								<button
									on:m-click={() => {
										dialogContent = {
											onConfirm: () => {
												goto(appPath("customers", `${row.id}`));
											},
											title: dialogTitle.delete(row.name),
											description: "Delete this order?",
											type: "commit"
										};
									}}
									use:dialogTrigger
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
					</div></CustomerOrderTable
				>
			</div>
			<ul class={testId("entity-list-container")} data-loaded={true}>
				{#if !$customerOrdersList.length}
					<!-- Start entity list placeholder -->
					<PlaceholderBox title="No open notes" description="Get started by adding a new note" class="center-absolute">
						<button on:click={() => {}} class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
							><span class="text-green-50">New Customer Order</span></button
						>
					</PlaceholderBox>
					<!-- End entity list placeholder -->
				{:else}
					<!-- Start entity list -->
					{#each $customerOrdersList as customerOrder}
						{@const name = `${customerOrder.name} ${customerOrder.surname}` || "Name Surname"}
						<!-- {@const updatedAt = generateUpdatedAtString(customerOrder.updatedAt)} -->
						{@const id = customerOrder.id}
						{@const email = customerOrder.email}
					{/each}
				{/if}
			</ul>
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
