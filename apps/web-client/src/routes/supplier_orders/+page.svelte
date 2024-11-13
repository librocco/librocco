<script lang="ts">
	import { Plus, Search, Loader2 as Loader } from "lucide-svelte";

	import { goto } from "$lib/utils/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import { Page, PlaceholderBox, ExtensionAvailabilityToast } from "$lib/components";

	import { appPath } from "$lib/paths";

	import { LL } from "$i18n/i18n-svelte";
	import { writable } from "svelte/store";
	import SupplierOrderTable, { type SupplierOrderData } from "$lib/components/Tables/OrderTables/SupplierOrderTable.svelte";

	$: ({ nav: tNav } = $LL);

	let initialized = true;

	let orders = writable<SupplierOrderData[]>([]);

	function handleCreateOrder() {
		// Append the new order to the orders list
		orders.update((orders) => {
			// Create a new order object
			const id = orders.length ? [...orders].pop().id + 1 : 1;
			const newOrder: SupplierOrderData = {
				id,
				supplierId: 1, // Assuming a default supplierId for new orders
				supplierName: "New Supplier",
				totalBooks: 0,
				placedAt: new Date().toISOString(),
				actionLink: appPath("supplier_orders", id.toString())
			};
			return [...orders, newOrder];
		});
	}
</script>

<Page view="orders/supplier_orders" loaded={initialized}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<!-- This is a global thing (link to stock) and should not be changed atm -->
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search orders" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">{tNav.supplier_orders()}</h1>
			<button
				on:click={handleCreateOrder}
				class="flex items-center gap-2 rounded-md border border-gray-300 bg-white py-[9px] pl-[15px] pr-[17px]"
			>
				<span><Plus size={20} /></span>
				<span class="text-sm font-medium leading-5 text-gray-700">New order</span>
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
			<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")} data-loaded={true}>
				{#if !$orders.length}
					<!-- Start entity list placeholder -->
					<PlaceholderBox title="No supplier orders" description="Get started by adding a new order" class="center-absolute">
						<button on:click={handleCreateOrder} class="mx-auto flex items-center gap-2 rounded-md bg-teal-500 py-[9px] pl-[15px] pr-[17px]"
							><span class="text-green-50">New order</span></button
						>
					</PlaceholderBox>
					<!-- End entity list placeholder -->
				{:else}
					<div>
						<SupplierOrderTable data={orders} />
					</div>
				{/if}
			</div>
			<!-- End entity list contaier -->
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>
