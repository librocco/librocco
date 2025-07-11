<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { racefreeGoto } from "$lib/utils/navigation";
	import { invalidate } from "$app/navigation";

	import type { PageData } from "./$types";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import { supplierSchema } from "$lib/forms";

	import { upsertSupplier } from "$lib/db/cr-sqlite/suppliers";
	import { SupplierTable } from "$lib/components";
	import { Page } from "$lib/controllers";

	import { writable } from "svelte/store";
	import SupplierMetaForm from "$lib/forms/SupplierMetaForm.svelte";
	import type { Supplier } from "$lib/db/cr-sqlite/types";
	import Plus from "$lucide/plus";
	import { appHash, appPath } from "$lib/paths";
	import LL from "@librocco/shared/i18n-svelte";

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

	// #region table
	const suppliersStore = writable(suppliers);
	$: suppliersStore.set(suppliers);
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

<Page title="Suppliers" view="orders/suppliers" {db} {plugins}>
	<div slot="main" class="flex flex-col gap-y-6 overflow-x-auto py-2">
		<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
			<div class="self-end">
				<button class="btn-outline btn-sm btn gap-2" on:click={() => dialogOpen.set(true)}>
					{t.labels.new_supplier()}
					<Plus size={20} />
				</button>
			</div>
			<SupplierTable data={suppliersStore}>
				<div class="flex gap-x-2" slot="row-actions" let:row>
					<button class="btn-outline btn-sm btn">{t.table.delete()}</button>
					<a href={appPath("suppliers", row.id)} class="btn-outline btn-sm btn">{t.table.edit()}</a>
				</div>
			</SupplierTable>
		</div>
	</div>
</Page>

<PageCenterDialog {dialog} title="" description="">
	<SupplierMetaForm
		heading="Create new supplier"
		saveLabel="Create"
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
		onCancel={() => dialogOpen.set(false)}
	/>
</PageCenterDialog>
