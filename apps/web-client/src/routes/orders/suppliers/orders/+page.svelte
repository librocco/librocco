<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { invalidate } from "$app/navigation";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { racefreeGoto } from "$lib/utils/navigation";

	import Settings from "$lucide/settings";
	import Plus from "$lucide/plus";
	import PackageOpen from "$lucide/package-open";

	import type { PageData } from "./$types";
	import type { Customer } from "$lib/db/cr-sqlite/types";
	import { appHash } from "$lib/paths";

	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema } from "$lib/forms";
	import { Page } from "$lib/controllers";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import UnorderedTable from "$lib/components/supplier-orders/UnorderedTable.svelte";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";
	import ReconcilingTable from "$lib/components/supplier-orders/ReconcilingTable.svelte";
	import CompletedTable from "$lib/components/supplier-orders/CompletedTable.svelte";
	import PlaceholderBox from "$lib/components/Placeholders/PlaceholderBox.svelte";

	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import {
		getCustomerDisplayIdSeq,
		getCustomerDisplayIdInfo,
		upsertCustomer,
		type CustomerDisplayIdInfo
	} from "$lib/db/cr-sqlite/customers";

	import LL from "@librocco/shared/i18n-svelte";
	import { downloadAsTextFile, generateLinesForDownload } from "$lib/utils/misc";
	import { getPlacedSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";

	import { page } from "$app/stores";

	import { app, getDb, getDbRx } from "$lib/app";

	export let data: PageData;

	let disposer: () => void;
	onMount(() => {
		if ($page.url.hash.split("?filter=").length <= 1) {
			goto(`${$page.url.hash}?filter=unordered`);
		}
		const disposer1 = getDbRx(app).onRange(["book"], () => invalidate("books:data"));
		const disposer2 = getDbRx(app).onRange(["supplier", "supplier_publisher"], () => invalidate("suppliers:data"));
		const disposer3 = getDbRx(app).onRange(["customer_order_lines"], () => invalidate("customers:order_lines"));
		const disposer4 = getDbRx(app).onRange(["reconciliation_order"], () => invalidate("reconciliation:orders"));

		disposer = () => (disposer1(), disposer2(), disposer3(), disposer4());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	$: ({ plugins, placedOrders, possibleOrders, reconcilingOrders, completedOrders } = data);

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	// State for new customer form
	let nextDisplayId = "";
	let existingCustomers: CustomerDisplayIdInfo[] = [];

	// Generate display ID and get existing IDs when opening the dialog
	const handleOpenNewOrderDialog = async () => {
		const db = await getDb(app);
		nextDisplayId = String(await getCustomerDisplayIdSeq(db));
		existingCustomers = await getCustomerDisplayIdInfo(db);
		newOrderDialogOpen.set(true);
	};

	$: hasPlacedOrders = placedOrders?.length;
	$: hasReconcilingOrders = reconcilingOrders?.length;
	$: hasCompletedOrders = completedOrders?.length;

	type OrderStatus = "unordered" | "ordered" | "reconciling" | "completed";

	let orderStatusFilter: OrderStatus = "unordered";
	function isOrderStatus(s: string | null): s is OrderStatus {
		return s === "unordered" || s === "ordered" || s === "reconciling" || s === "completed";
	}
	$: {
		const params = new URLSearchParams($page.url.hash.split("?")[1] ?? "");
		const s = params.get("filter")?.split("/")[0];
		orderStatusFilter = isOrderStatus(s) ? s : "unordered";
	}
	function setFilter(status: OrderStatus) {
		const [base, search = ""] = $page.url.hash.split("?");
		const params = new URLSearchParams(search);
		params.set("filter", status);
		// Let URL drive the reactive state; no need to pre-set `orderStatusFilter`.
		goto(`${base}?${params.toString()}`);
	}

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const db = await getDb(app);

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createReconciliationOrder(db, id, event.detail.supplierOrderIds);
		goto(appHash("reconcile", id));
	}

	async function handleDownload(event: CustomEvent<{ supplierOrderId: number }>) {
		const db = await getDb(app);

		const lines = await getPlacedSupplierOrderLines(db, [event.detail.supplierOrderId]);

		const generatedLines = generateLinesForDownload(lines[0]?.customerId, lines[0]?.orderFormat, lines);

		downloadAsTextFile(generatedLines, `${event.detail.supplierOrderId}-${lines[0]?.supplier_name}-${lines[0]?.orderFormat}`);
	}

	const createCustomer = async (customer: Omit<Customer, "id">) => {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const db = await getDb(app);

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation

		await upsertCustomer(db, { ...customer, id });

		newOrderDialogOpen.set(false);

		await goto(appHash("customers", id));
	};

	$: t = $LL.supplier_orders_page;
</script>

<Page title={t.title.supplier_orders()} view="orders/suppliers/orders" {app} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-2 divide-y">
		<div class="flex flex-row justify-between gap-x-2 overflow-x-auto p-4">
			<div class="flex gap-2 px-2" role="group" aria-label="Filter orders by status">
				<button
					class="btn-sm btn {orderStatusFilter === 'unordered' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => setFilter("unordered")}
					aria-pressed={orderStatusFilter === "unordered"}
				>
					{t.tabs.unordered()}
				</button>

				<button
					class="btn-sm btn {orderStatusFilter === 'ordered' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => setFilter("ordered")}
					aria-pressed={orderStatusFilter === "ordered"}
					disabled={!hasPlacedOrders}
					data-testid="ordered-list"
				>
					{t.tabs.ordered()}
				</button>

				<button
					class="btn-sm btn {orderStatusFilter === 'reconciling' ? 'btn-primary' : 'btn-outline'}"
					on:click={() => setFilter("reconciling")}
					aria-pressed={orderStatusFilter === "reconciling"}
					disabled={!hasReconcilingOrders}
					data-testid="reconciling-list"
				>
					{t.tabs.reconciling()}
				</button>
				<div class="w-fit">
					<button
						class="btn-sm btn self-end {orderStatusFilter === 'completed' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("completed")}
						aria-pressed={orderStatusFilter === "completed"}
						disabled={!hasCompletedOrders}
						data-testid="completed-list"
					>
						{t.tabs.completed()}
					</button>
				</div>
			</div>

			<button class="btn-outline btn-sm btn gap-2" on:click={() => goto(appHash("suppliers"))}>
				{t.labels.suppliers()}
				<Settings size={20} />
			</button>
		</div>

		<div class="h-full w-full p-4">
			{#if orderStatusFilter === "unordered"}
				{#if possibleOrders.length === 0 && placedOrders.length === 0}
					<div class="mx-auto w-fit max-w-xl translate-y-1/2">
						<PlaceholderBox title={t.placeholder.title()} description={t.placeholder.description()}>
							<PackageOpen slot="icon" />

							<button slot="actions" class="btn-primary btn gap-2" on:click={handleOpenNewOrderDialog}>
								<Plus size={20} />
								<p>{t.placeholder.button()}</p>
							</button>
						</PlaceholderBox>
					</div>
				{:else}
					<UnorderedTable orders={possibleOrders} />
				{/if}
			{:else if orderStatusFilter === "ordered"}
				<OrderedTable orders={placedOrders} on:reconcile={handleReconcile} on:download={handleDownload} />
			{:else if orderStatusFilter === "reconciling"}
				<ReconcilingTable orders={reconcilingOrders} />
			{:else}
				<CompletedTable orders={completedOrders} />
			{/if}
		</div>
	</div>
</Page>

<PageCenterDialog dialog={newOrderDialog} title="" description="">
	<CustomerOrderMetaForm
		heading="Create new order"
		saveLabel="Create"
		data={defaults({ displayId: nextDisplayId }, zod(createCustomerOrderSchema($LL, existingCustomers)))}
		options={{
			SPA: true,
			validators: zod(createCustomerOrderSchema($LL, existingCustomers)),
			onSubmit: async ({ validators }) => {
				const db = await getDb(app);

				// Get the latest customer data to ensure we're validating against current state
				const latestCustomerIds = await getCustomerDisplayIdInfo(db);

				// Create a new schema instance with the latest data and error message generator
				const updatedSchema = createCustomerOrderSchema($LL, latestCustomerIds);

				// Update the validator with the new schema
				validators(zod(updatedSchema));
			},
			onUpdate: async ({ form }) => {
				if (form.valid) {
					const phone = [form.data.phone1, form.data.phone2].join(",");
					await createCustomer({ ...form.data, phone });
				}
			}
		}}
		onCancel={() => newOrderDialogOpen.set(false)}
	/>
</PageCenterDialog>
