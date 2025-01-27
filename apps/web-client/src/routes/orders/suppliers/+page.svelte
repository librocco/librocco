<script lang="ts">
	import { Plus } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { goto } from "$lib/utils/navigation";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema } from "$lib/forms";
	import { base } from "$app/paths";
	import { supplierOrderFilterStatus, type SupplierOrderFilterStatus } from "$lib/stores/supplier-order-filters";
	import UnorderedTable from "$lib/components/supplier-orders/UnorderedTable.svelte";
	import ReconcilingTable from "$lib/components/supplier-orders/ReconcilingTable.svelte";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";
	import type { LayoutData } from "./$types";
	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import {
		associatePublisher,
		createSupplierOrder,
		getPlacedSupplierOrders,
		getPossibleSupplierOrderLines,
		upsertSupplier
	} from "$lib/db/cr-sqlite/suppliers";
	import { addBooksToCustomer, upsertCustomer } from "$lib/db/cr-sqlite/customers";
	import { upsertBook } from "$lib/db/cr-sqlite/books";

	export let data: LayoutData;

	let publisherSupplierCreated = false;

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	$: hasOrderedOrders = data.placedOrders.length;
	$: hasReconcilingOrders = data.reconcilingOrders.length;

	function setFilter(status: SupplierOrderFilterStatus) {
		supplierOrderFilterStatus.set(status);
	}

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		if (!data || !data?.ordersDb) {
			console.error("Database connection not available");
			return;
		}

		const id = await createReconciliationOrder(data.ordersDb, event.detail.supplierOrderIds);
		goto(`${base}/orders/suppliers/reconcile/${id}`);
	}
</script>

<header class="navbar mb-4 bg-neutral">
	<input type="checkbox" value="forest" class="theme-controller toggle" />

	<button
		class="bg-white"
		disabled={publisherSupplierCreated}
		aria-label="CreateReconciliationOrder"
		on:click={async () => {
			await upsertBook(data?.ordersDb, {
				isbn: "123456789",
				title: "Book 1",
				authors: "Author 1",
				price: 10,
				publisher: "abcPub"
			});

			await upsertCustomer(data?.ordersDb, { id: 1, displayId: "1", email: "cus@tom.er", fullname: "cus tomer", deposit: 100 });
			await addBooksToCustomer(data?.ordersDb, 1, ["123456789"]);
			await upsertSupplier(data?.ordersDb, { id: 123, name: "abcSup" });
			await associatePublisher(data?.ordersDb, 123, "abcPub");

			const possibleLines = await getPossibleSupplierOrderLines(data?.ordersDb, 123);

			await createSupplierOrder(data?.ordersDb, possibleLines);

			publisherSupplierCreated = true;
		}}>Create publisher/supplier</button
	>
</header>

<main class="h-screen">
	<div class="mx-auto flex h-full max-w-5xl flex-col gap-y-10 px-4">
		<div class="flex items-center justify-between">
			<h1 class="prose text-2xl font-bold">Supplier Orders</h1>
		</div>

		<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
			{#if data?.possibleOrders.length === 0 && data?.placedOrders.length === 0}
				<div class="flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-base-300 p-6">
					<p class="text-center text-base-content/70">
						No supplier orders available. Create a customer order first to generate supplier orders.
					</p>
					<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
						<Plus size={20} />
						New Customer Order
					</button>
				</div>
			{:else}
				<div class="flex gap-2 px-2" role="group" aria-label="Filter orders by status">
					<button
						class="btn-sm btn {$supplierOrderFilterStatus === 'unordered' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("unordered")}
						aria-pressed={$supplierOrderFilterStatus === "unordered"}
					>
						Unordered
					</button>
					<button
						class="btn-sm btn {$supplierOrderFilterStatus === 'ordered' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("ordered")}
						aria-pressed={$supplierOrderFilterStatus === "ordered"}
						disabled={!hasOrderedOrders}
						data-testid="ordered-list"
					>
						Ordered
					</button>
					<button
						class="btn-sm btn {$supplierOrderFilterStatus === 'reconciling' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("reconciling")}
						aria-pressed={$supplierOrderFilterStatus === "reconciling"}
						disabled={!hasReconcilingOrders}
						data-testid="reconciling-list"
					>
						Reconciling
					</button>
					<button class="btn-outline btn-sm btn" disabled> Received </button>
					<button class="btn-outline btn-sm btn" disabled> Completed </button>
				</div>
				{#if $supplierOrderFilterStatus === "unordered"}
					<UnorderedTable orders={data.possibleOrders} />
				{:else if $supplierOrderFilterStatus === "ordered"}
					<OrderedTable orders={data.placedOrders} on:reconcile={handleReconcile} />
				{:else}
					<ReconcilingTable orders={data.reconcilingOrders} />
				{/if}
			{/if}
		</div>
	</div>
</main>

<PageCenterDialog dialog={newOrderDialog} title="" description="">
	<CustomerOrderMetaForm
		heading="Create new order"
		saveLabel="Create"
		kind="create"
		data={defaults(zod(createCustomerOrderSchema("create")))}
		options={{
			SPA: true,
			validators: zod(createCustomerOrderSchema("update")),
			onUpdate: ({ form }) => {
				if (form.valid) {
					// TODO: update data
				}
			},
			onUpdated: async ({ form }) => {
				if (form.valid) {
					const newCustomerId = Math.floor(Math.random() * 1000000); // Temporary ID generation
					newOrderDialogOpen.set(false);
					await goto(`${base}/orders/customers/${newCustomerId}`);
				}
			}
		}}
		onCancel={() => newOrderDialogOpen.set(false)}
	/>
</PageCenterDialog>
