<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { Mail, UserCircle, PencilLine, Plus } from "lucide-svelte";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { invalidate } from "$app/navigation";
	import { page } from "$app/stores";

	import { stripNulls } from "@librocco/shared";

	import type { Supplier } from "$lib/db/cr-sqlite/types";
	import type { PageData } from "./$types";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";

	import { supplierSchema } from "$lib/forms/schemas";
	import { upsertSupplier, associatePublisher, removePublisherFromSupplier } from "$lib/db/cr-sqlite/suppliers";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";
	import { racefreeGoto } from "$lib/utils/navigation";
	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { appPath } from "$lib/paths";
	import SupplierMetaForm from "$lib/forms/SupplierMetaForm.svelte";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;

	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload add supplier data dependants when the data changes
		const disposer1 = rx.onPoint("supplier", BigInt($page.params.id), () => invalidate("supplier:data"));
		// Changes to supplier orders, supplier publishers
		const disposer2 = rx.onRange(["supplier_publisher", "supplier_order"], () => invalidate("supplier:orders"));
		disposer = () => (disposer1(), disposer2());
	});

	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	// #endregion reactivity

	$: goto = racefreeGoto(disposer);

	$: db = data.dbCtx?.db;

	$: supplier = data?.supplier;

	$: assignedPublishers = data?.assignedPublishers;
	$: unassignedPublishers = data?.unassignedPublishers;

	// #region dialog
	const dialog = createDialog(defaultDialogConfig);
	const {
		states: { open: dialogOpen }
	} = dialog;
	// #endregion dialog

	const handleUpdateSupplier = async (_data: Partial<Supplier>) => {
		const data = { ...stripNulls(supplier), ..._data };
		await upsertSupplier(db, data);
		dialogOpen.set(false);
	};

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createReconciliationOrder(db, id, event.detail.supplierOrderIds);
		goto(appPath("reconcile", id));
	}

	const handleAssignPublisher = (publisher: string) => async () => {
		await associatePublisher(db, supplier.id, publisher);
	};

	const handleUnassignPublisher = (publisher: string) => async () => {
		await removePublisherFromSupplier(db, supplier.id, publisher);
	};
</script>

<header class="navbar mb-4 bg-neutral">
	<input type="checkbox" value="forest" class="theme-controller toggle" />
</header>

<main class="h-screen">
	<div class="flex h-full flex-col gap-y-10 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
		<div class="min-w-fit md:basis-96 md:overflow-y-auto">
			<div class="card h-full">
				<div class="card-body gap-y-2 p-0">
					<div class="sticky top-0 flex flex-col gap-y-2 bg-base-100 pb-3">
						<h1 class="prose card-title">Supplier page</h1>

						<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
							<h2 class="prose">#{supplier?.id}</h2>
						</div>
					</div>

					<dl class="flex flex-col">
						<div class="flex w-full flex-col gap-y-4 py-6">
							<div class="flex w-full flex-wrap justify-between gap-y-4 md:flex-col">
								{#if supplier}
									<div class="max-w-96 flex flex-col gap-y-4">
										<div class="flex gap-x-3">
											<dt>
												<span class="sr-only">Supplier name</span>
												<UserCircle aria-hidden="true" class="h-6 w-5 text-gray-400" />
											</dt>
											<dd class="truncate">{supplier.name}</dd>
										</div>

										<div class="flex gap-x-3">
											<dt>
												<span class="sr-only">Supplier email</span>
												<Mail aria-hidden="true" class="h-6 w-5 text-gray-400" />
											</dt>
											<dd class="truncate">{supplier.email || "N/A"}</dd>
										</div>

										<div class="flex gap-x-3">
											<dt>
												<span class="sr-only">Supplier address</span>
												<Mail aria-hidden="true" class="h-6 w-5 text-gray-400" />
											</dt>
											<dd class="truncate">{supplier.address || "N/A"}</dd>
										</div>
									</div>
								{/if}
							</div>

							<div class="w-full pr-2">
								<button
									class="btn-secondary btn-outline btn-xs btn w-full"
									type="button"
									aria-label="Edit supplier name, email or address"
									on:click={() => dialogOpen.set(true)}
								>
									<PencilLine aria-hidden size={16} />
								</button>
							</div>
						</div>
					</dl>

					<div class="card-actions border-t py-6 md:mb-20">
						<a href={appPath("suppliers", supplier.id, "new-order")} class="btn-secondary btn-outline btn-sm btn" type="button">
							Create new order
							<Plus aria-hidden size={20} />
						</a>
					</div>
				</div>
			</div>
		</div>

		<div class="mb-20 flex h-full w-full flex-col gap-y-6 md:overflow-y-auto">
			<div class="prose flex w-full max-w-full flex-row gap-x-8 md:px-4">
				<div class="w-full">
					<h2 class="text-lg">Assigned publishers</h2>
					<div class="w-full rounded border border-gray-200">
						<table class="!my-0 flex-col items-stretch overflow-hidden">
							<thead>
								<tr>
									<th scope="col" class="px-2 py-2">Publisher name</th>
								</tr>
							</thead>
							<tbody>
								{#each assignedPublishers as publisher}
									<tr class="hover focus-within:bg-base-200">
										<td class="px-2">{publisher}</td>
										<td class="px-2 text-end"
											><button on:click={handleUnassignPublisher(publisher)} class="btn-primary btn-xs btn flex-nowrap gap-x-2.5 rounded-lg"
												>Remove publisher</button
											></td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<div class="w-full">
					<h2 class="text-lg">Unassigned publishers</h2>
					<div class="w-full rounded border border-gray-200">
						<table class="!my-0 flex-col items-stretch overflow-hidden">
							<thead>
								<tr>
									<th scope="col" class="px-2 py-2">Publisher name</th>
								</tr>
							</thead>
							<tbody>
								{#each unassignedPublishers as publisher}
									<tr class="hover focus-within:bg-base-200">
										<td class="px-2">{publisher}</td>
										<td class="px-2 text-end"
											><button on:click={handleAssignPublisher(publisher)} class="btn-primary btn-xs btn flex-nowrap gap-x-2.5 rounded-lg"
												>Add to supplier</button
											></td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div class="h-full overflow-x-auto">
				<div class="h-full">
					<OrderedTable orders={data.orders} on:reconcile={handleReconcile} />
				</div>
			</div>
		</div>
	</div>
</main>

<PageCenterDialog {dialog} title="" description="">
	<SupplierMetaForm
		heading="Update supplier details"
		saveLabel="Save"
		data={defaults(stripNulls(supplier), zod(supplierSchema))}
		options={{
			SPA: true,
			validators: zod(supplierSchema),
			onUpdate: ({ form }) => {
				if (form.valid) {
					handleUpdateSupplier(form.data);
				}
			}
		}}
		onCancel={() => dialogOpen.set(false)}
	/>
</PageCenterDialog>

<style global>
	:global(html) {
		overflow-x: hidden;
		height: 100%;
		margin-right: calc(-1 * (100vw - 100%));
	}

	:global(body) {
		height: 100%;
		padding: 0;
	}
</style>
