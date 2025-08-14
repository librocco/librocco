<script lang="ts">
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";

	import Plus from "$lucide/plus";
	import PackageOpen from "$lucide/package-open";

	import type { PageData } from "./$types";
	import type { Customer } from "$lib/db/cr-sqlite/types";
	import { appHash } from "$lib/paths";

	import CustomerOrderMetaForm from "$lib/forms/CustomerOrderMetaForm.svelte";
	import { createCustomerOrderSchema } from "$lib/forms";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import UnorderedTable from "$lib/components/supplier-orders/UnorderedTable.svelte";
	import PlaceholderBox from "$lib/components/Placeholders/PlaceholderBox.svelte";

	import { getCustomerDisplayIdSeq, upsertCustomer } from "$lib/db/cr-sqlite/customers";

	import LL from "@librocco/shared/i18n-svelte";
	import { goto } from "$lib/utils/navigation";

	export let data: PageData;

	$: ({ possibleOrders, placedOrders } = data);
	$: db = data?.dbCtx?.db;

	const newOrderDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: newOrderDialogOpen }
	} = newOrderDialog;

	const createCustomer = async (customer: Omit<Customer, "id" | "displayId">) => {
		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		const displayId = await getCustomerDisplayIdSeq(db).then(String);

		await upsertCustomer(db, { ...customer, id, displayId });

		newOrderDialogOpen.set(false);

		await goto(appHash("customers", id));
	};

	$: t = $LL.supplier_orders_page;
</script>

{#if possibleOrders.length === 0 && placedOrders.length === 0}
	<div class="mx-auto w-fit max-w-xl translate-y-1/2">
		<PlaceholderBox title={t.placeholder.title()} description={t.placeholder.description()}>
			<PackageOpen slot="icon" />

			<button slot="actions" class="btn-primary btn gap-2" on:click={() => newOrderDialogOpen.set(true)}>
				<Plus size={20} />
				<p>{t.placeholder.button()}</p>
			</button>
		</PlaceholderBox>
	</div>
{:else}
	<UnorderedTable orders={possibleOrders} />
{/if}

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
					createCustomer(form.data);
				}
			}
		}}
		onCancel={() => newOrderDialogOpen.set(false)}
	/>
</PageCenterDialog>
