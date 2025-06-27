<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { writable } from "svelte/store";

	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";

	import Plus from "$lucide/plus";
	import User from "$lucide/user";
	import ClockArrowUp from "$lucide/clock-arrow-up";

	import LL from "@librocco/shared/i18n-svelte";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import CustomerSearchForm from "$lib/forms/CustomerSearchForm.svelte";
	import PlaceholderBox from "$lib/components/Placeholders/PlaceholderBox.svelte";
	import { createCustomerOrderSchema, customerSearchSchema } from "$lib/forms";

	import { invalidate } from "$app/navigation";
	import { racefreeGoto } from "$lib/utils/navigation";
	import { appPath, appHash } from "$lib/paths";
	import { Page } from "$lib/controllers";
	import { createIntersectionObserver } from "$lib/actions";

	import { getCustomerDisplayIdSeq, upsertCustomer } from "$lib/db/cr-sqlite/customers";
	import type { Customer, CustomerOrderListItem } from "$lib/db/cr-sqlite/types";

	import type { PageData } from "./$types";

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
	<div slot="main" class="flex h-full flex-col gap-y-2 divide-y">
		<div class="flex flex-row gap-x-2 p-4">
			<CustomerSearchForm
				bind:input={searchField}
				placeholder={t.placeholder.search()}
				data={defaults(zod(customerSearchSchema))}
				options={{
					SPA: true,
					dataType: "json",
					invalidateAll: false,
					resetForm: false,
					validators: zod(customerSearchSchema),
					validationMethod: "oninput",
					onChange: async (event) => {
						const [fullNamePath] = event.paths;
						const fullName = event.get(fullNamePath);

						search.set(fullName); // reactively update the store on input change
					}
				}}
			/>
			<button class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
				<Plus size={20} />
				{t.labels.new_order()}
			</button>
		</div>
		<div class="h-full p-4">
			{#if !customerOrders.length}
				<div class="mx-auto max-w-xl translate-y-1/2">
					<PlaceholderBox title={t.placeholder.no_orders.title()} description={t.placeholder.no_orders.description()}>
						<User slot="icon" />

						<button slot="actions" class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
							<Plus size={20} />
							{t.labels.new_order()}
						</button>
					</PlaceholderBox>
				</div>
			{:else}
				<div use:scroll.container={{ rootMargin: "50px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
					<table class="table-zebra table-sm table">
						<thead>
							<tr>
								<th scope="col">{t.table_columns.order_id()}</th>
								<th scope="col">{t.table_columns.name()}</th>
								<th scope="col">{t.table_columns.email()}</th>
								<th scope="col">{t.table_columns.updated()}</th>
								<th scope="col" class="sr-only">{t.table_columns.actions()}</th>
							</tr>
						</thead>
						<tbody>
							{#each $tableStore as { id, fullname, email, updatedAt, displayId }}
								<tr class="hover focus-within:bg-base-200 hover:cursor-pointer" on:click={() => goto(appPath("customers", id))}>
									<th>
										<span class="font-medium">#{displayId}</span>
									</th>
									<td>
										{fullname}
									</td>
									<td>
										{email === "N/A" ? "-" : email}
									</td>
									<td>
										<span class="badge-primary badge-outline badge gap-x-2">
											<ClockArrowUp size={16} />
											<time dateTime={new Date(updatedAt).toISOString()}>{new Date(updatedAt).toLocaleString()}</time>
										</span>
									</td>
									<td>
										<a href={appPath("customers", id)} class="btn-outline btn-sm btn">{t.labels.edit()}</a>
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
	</div>
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
