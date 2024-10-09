<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Plus, Search, Trash, Loader2 as Loader, Library, PersonStanding } from "lucide-svelte";
	import { firstValueFrom, map } from "rxjs";

	import { goto } from "$lib/utils/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import { getDB } from "$lib/db";

	import { Page, PlaceholderBox, Dialog, ExtensionAvailabilityToast, CustomerOrderTable } from "$lib/components";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";
	import { compareNotes } from "$lib/utils/misc";

	import { appPath } from "$lib/paths";
	import { readable, writable } from "svelte/store";
	import { Observable, from } from "rxjs";

	const { db, status } = getDB();

	const customersCtx = { name: "[CUSTOMERS_LIST]", debug: false };
	const customersPromise = new Promise<{ name: string; surname: string; id: number; email: string }[]>((resolve) =>
		setTimeout(() => {
			resolve([
				{ name: "Fadwa", surname: "Mahmoud", id: 1234, email: "fadwa.mahmoud@gmail.com" },
				{ name: "Not Fadwa", surname: "Mahmoud", id: 112234, email: "not.fadwa.mahmoud@gmail.com" }
			]);
		}, 500)
	);
	const customerStream = from(customersPromise);

	const customerOrdersList = readable([
		{ name: "Fadwa", surname: "Mahmoud", id: 1234, email: "fadwa.mahmoud@gmail.com" },
		{ name: "Not Fadwa", surname: "Mahmoud", id: 112234, email: "not.fadwa.mahmoud@gmail.com" }
	]);

	// const customerOrdersList = readableFromStream(customersCtx, customerStream, []);

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
			<button on:click={() => {}} class="flex items-center gap-2 rounded-md border border-gray-300 bg-white py-[9px] pl-[15px] pr-[17px]">
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
				<CustomerOrderTable data={customerOrdersList} />
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

						<!-- {@const href = appPath("customerOrders", customerOrderId)} -->
					{/each}
				{/if}
			</ul>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>
