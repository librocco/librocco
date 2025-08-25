<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { writable } from "svelte/store";

	import Plus from "$lucide/plus";
	import Truck from "$lucide/truck";

	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { racefreeGoto } from "$lib/utils/navigation";
	import { invalidate } from "$app/navigation";

	import LL from "@librocco/shared/i18n-svelte";

	import { supplierSchema } from "$lib/forms";
	import SupplierMetaForm from "$lib/forms/SupplierMetaForm.svelte";
	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import PlaceholderBox from "$lib/components/Placeholders/PlaceholderBox.svelte";
	import { Page } from "$lib/controllers";
	import { createIntersectionObserver } from "$lib/actions";

	import { upsertSupplier } from "$lib/db/cr-sqlite/suppliers";

	import type { Supplier } from "$lib/db/cr-sqlite/types";
	import { appHash, appPath } from "$lib/paths";

	import type { PageData } from "./$types";
	import { orderFormats } from "$lib/enums/orders";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload when note
		// Reload when entries (book/custom item) change
		disposer = data.dbCtx?.rx?.onRange(["supplier", "supplier_publisher"], () => invalidate("suppliers:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});

	$: goto = racefreeGoto(disposer);

	$: ({ plugins, suppliers } = data);
	$: db = data?.dbCtx?.db;

	const seeMore = () => {
		maxResults += 10;
	};
	const scroll = createIntersectionObserver(seeMore);
	let maxResults = 10;

	// #region table
	const suppliersStore = writable(suppliers);
	$: suppliersStore.set(suppliers.slice(0, maxResults));
	// #endregion table

	$: t = $LL.suppliers_page;

	const dialog = createDialog(defaultDialogConfig);
	const {
		states: { open: dialogOpen }
	} = dialog;

	const createSupplier = async (supplier: Omit<Supplier, "id">) => {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1
		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation

		await upsertSupplier(db, { ...supplier, id });

		dialogOpen.set(false);

		await goto(appHash("suppliers", id));
	};
</script>

<Page title={t.title()} view="orders/suppliers" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-2 divide-y">
		<div class="flex w-full flex-row justify-end gap-x-2 p-4">
			<button class="btn-outline btn-sm btn gap-2" on:click={() => dialogOpen.set(true)}>
				{t.labels.new_supplier()}
				<Plus size={20} />
			</button>
		</div>
		<div class="h-full p-4">
			{#if !suppliers.length}
				<div class="mx-auto w-fit max-w-xl translate-y-1/2">
					<PlaceholderBox title={t.placeholder.title()} description={t.placeholder.description()}>
						<Truck slot="icon" />

						<button slot="actions" class="btn-primary btn gap-2" on:click={() => dialogOpen.set(true)}>
							<Plus size={20} />
							{t.labels.new_supplier()}
						</button>
					</PlaceholderBox>
				</div>
			{:else}
				<div use:scroll.container={{ rootMargin: "50px" }} class="h-full overflow-auto" style="scrollbar-width: thin">
					<table class="table-sm table" id="supplier-orders">
						<thead>
							<tr>
								<th scope="col">{t.columns.name()}</th>
								<th scope="col">{t.columns.email()}</th>
								<th scope="col">{t.columns.address()}</th>
								<th scope="col">{t.columns.assigned_publishers()}</th>
								<th scope="col">{t.columns.order_format()}</th>
								<th scope="col" class="sr-only">
									{t.columns.actions()}
								</th>
							</tr>
						</thead>

						<tbody>
							{#each $suppliersStore as row (row.id)}
								{@const { id, name, email, address, numPublishers, orderFormat } = row}
								<tr class="hover focus-within:bg-base-200 hover:cursor-pointer" on:click={() => goto(appPath("suppliers", id))}>
									<th scope="row" data-property="supplier">
										{name}
									</th>

									<td data-property="email">{email}</td>

									<td data-property="address">{address}</td>

									<td data-property="assigned-publishers">{numPublishers}</td>

									<td data-property="order-format">{orderFormat}</td>

									<td class="text-right">
										<a href={appPath("suppliers", id)} class="btn-outline btn-sm btn">{t.labels.edit()}</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</Page>

<PageCenterDialog {dialog} title="" description="">
	<SupplierMetaForm
		heading={t.dialog.new_order_title()}
		saveLabel={t.labels.save()}
		data={defaults(zod(supplierSchema))}
		options={{
			SPA: true,
			validators: zod(supplierSchema),
			onUpdate: ({ form }) => {
				if (form.valid) {
					createSupplier(form.data);
				}
			}
		}}
		formatList={orderFormats}
		onCancel={() => dialogOpen.set(false)}
	/>
</PageCenterDialog>
