<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Plus from "$lucide/plus";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { invalidate } from "$app/navigation";
	import { racefreeGoto } from "$lib/utils/navigation";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema, customerSearchSchema } from "$lib/forms";
	import { appPath, appHash } from "$lib/paths";

	import { getCustomerDisplayIdSeq, upsertCustomer } from "$lib/db/cr-sqlite/customers";

	import { Page } from "$lib/controllers";
	import type { Customer, CustomerOrderListItem } from "$lib/db/cr-sqlite/types";

	import type { PageData } from "./$types";

	import CustomerSearchForm from "$lib/forms/CustomerSearchForm.svelte";
	import { writable } from "svelte/store";
	import { createIntersectionObserver } from "$lib/actions";

	export let data: PageData;

	$: ({ customerOrders, plugins } = data);
	$: db = data.dbCtx?.db;

	let searchField: HTMLInputElement;
	const search = writable("");

	$: t = $LL.customer_orders_page;
	const tableStore = writable<CustomerOrderListItem[]>(customerOrders);

	const seeMore = () => {
		maxResults += 10;
	};
	const scroll = createIntersectionObserver(seeMore);
	let maxResults = 10;

	$: filteredOrders = customerOrders
		.filter(({ completed }) => completed === (orderFilterStatus === "completed"))
		.filter(({ fullname, displayId }) => {
			if (!$search) return true;
			return fullname.toLowerCase().includes($search.toLowerCase()) || displayId.toLowerCase().includes($search.toLowerCase());
		});

	$: tableStore.set(filteredOrders.slice(0, maxResults));
	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload all customer order/customer order line data dependants when the data changes
		disposer = data.dbCtx?.rx?.onRange(["customer", "customer_order_lines"], () => invalidate("customer:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer();
	});
	$: goto = racefreeGoto(disposer);

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	/**
	 * Toggle between in-progress and completed orders:
	 */
	let orderFilterStatus: "completed" | "in_progress" = "in_progress";
	function setFilter(status: "completed" | "in_progress") {
		orderFilterStatus = status;
	}

	$: hasCompletedOrders = customerOrders.some(({ completed }) => completed);

	const createCustomer = async (customer: Omit<Customer, "id" | "displayId">) => {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		// NOTE: dbCtx should always be defined on client
		const { db } = data.dbCtx;

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		const displayId = await getCustomerDisplayIdSeq(db).then(String);

		await upsertCustomer(db, { ...customer, id, displayId });

		newOrderDialogOpen.set(false);

		await goto(appHash("customers", id));
	};
</script>

<Page title="Customer Orders" view="orders/customers" {db} {plugins}>
	<div slot="main" class="flex flex-col gap-y-6 overflow-x-auto py-2">
		<div class="p-4">
			<CustomerSearchForm
				bind:input={searchField}
				placeholder="Search for customers by name"
				data={defaults(zod(customerSearchSchema))}
				options={{
					SPA: true,
					dataType: "json",
					validators: zod(customerSearchSchema),
					validationMethod: "submit-only",
					onUpdate: async ({ form }) => {
						const { fullname } = form?.data as CustomerOrderListItem;
						search.set(fullname);
					}
				}}
			/>
		</div>
		{#if !customerOrders.length}
			<div class="flex h-96 flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-base-300 p-6">
				<p class="text-center text-base-content/70">No customer orders yet. Create your first order to get started.</p>
				<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
					<Plus size={20} />
					{t.labels.new_order()}
				</button>
			</div>
		{:else}
			<div class="flex justify-between gap-2 px-2" role="group" aria-label="Filter orders by status">
				<div class="flex gap-x-2">
					<button
						class="btn-sm btn {orderFilterStatus === 'in_progress' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("in_progress")}
						aria-pressed={orderFilterStatus === "in_progress"}
					>
						{t.tabs.in_progress()}
					</button>
					<button
						class="btn-sm btn {orderFilterStatus === 'completed' ? 'btn-primary' : 'btn-outline'}"
						on:click={() => setFilter("completed")}
						aria-pressed={orderFilterStatus === "completed"}
						disabled={!hasCompletedOrders}
					>
						{t.tabs.completed()}
					</button>
				</div>
				<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
					<Plus size={20} />
					{t.labels.new_order()}
				</button>
			</div>
			<div use:scroll.container={{ rootMargin: "50px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<table class="table-lg table">
					<thead>
						<tr>
							<th scope="col">{t.table.customer()}</th>
							<th scope="col">{t.table.order_id()}</th>
							<th scope="col"> <span class="sr-only"> {t.labels.update_order()} </span></th>
						</tr>
					</thead>
					<tbody>
						{#each $tableStore as { id, fullname, email, displayId }}
							<tr class="hover focus-within:bg-base-200">
								<td>
									<dl class="flex flex-col gap-y-1">
										<dt class="sr-only">{t.table.customer_details()}</dt>
										<dd>{fullname}</dd>
										<dd class="text-sm">{email ?? ""}</dd>
									</dl>
								</td>
								<td>
									<span class="font-medium">{displayId}</span>
								</td>
								<td class="text-right">
									<a href={appPath("customers", id)} class="btn-outline btn-sm btn">{t.labels.update()}</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<!-- Trigger for the infinite scroll intersection observer -->
				{#if $tableStore?.length === maxResults && filteredOrders.length > maxResults}
					<div use:scroll.trigger></div>
				{/if}
			</div>
		{/if}
	</div>
	<!-- </div> -->
</Page>

<PageCenterDialog dialog={newOrderDialog} title="" description="">
	<CustomerOrderMetaForm
		heading="Create new order"
		saveLabel="Create"
		kind="create"
		data={defaults(zod(createCustomerOrderSchema("create")))}
		options={{
			SPA: true,
			validators: zod(createCustomerOrderSchema("create")),
			onUpdate: ({ form }) => {
				if (form.valid) {
					const phone = [form.data.phone1, form.data.phone2].join(",");
					createCustomer({ ...form.data, phone });
				}
			}
		}}
		onCancel={() => newOrderDialogOpen.set(false)}
	/>
</PageCenterDialog>

<style>
	.table-lg td {
		padding-top: 1rem;
		padding-bottom: 1rem;
	}
</style>
