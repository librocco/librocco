<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { writable } from "svelte/store";
	import { Download, PencilLine, Plus, Mail } from "$lucide";
	import UserCircle from "$lucide/user-circle";
	import { createDialog } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { invalidate } from "$app/navigation";
	import { page } from "$app/stores";

	import { stripNulls } from "@librocco/shared";

	import type { Supplier } from "$lib/db/cr-sqlite/types";
	import type { PageData } from "./$types";

	import { PageCenterDialog, defaultDialogConfig } from "$lib/components/Melt";
	import { Page } from "$lib/controllers";

	import { supplierSchema } from "$lib/forms/schemas";
	import {
		upsertSupplier,
		associatePublisher,
		removePublisherFromSupplier,
		getPlacedSupplierOrderLines
	} from "$lib/db/cr-sqlite/suppliers";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";
	import { racefreeGoto } from "$lib/utils/navigation";
	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
	import { appPath } from "$lib/paths";
	import SupplierMetaForm from "$lib/forms/SupplierMetaForm.svelte";
	import LL from "@librocco/shared/i18n-svelte";
	import ConfirmDialog from "$lib/components/Dialogs/ConfirmDialog.svelte";
	import { downloadAsTextFile, generateLinesForDownload } from "$lib/utils/misc";
	import { orderFormats } from "$lib/enums/orders";

	import { app } from "$lib/app";
	import { getDb, getDbRx } from "$lib/app/db";

	export let data: PageData;

	let searchQuery = "";

	// #region reactivity
	let disposer: () => void;

	onMount(() => {
		// Reload add supplier data dependants when the data changes
		const disposer1 = getDbRx(app).onPoint("supplier", BigInt($page.params.id), () => invalidate("supplier:data"));
		// Changes to supplier orders, supplier publishers
		const disposer2 = getDbRx(app).onRange(["supplier_publisher", "supplier_order"], () => invalidate("supplier:orders"));
		disposer = () => (disposer1(), disposer2());
	});

	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	// #endregion reactivity
	type Tab = "orders" | "publishers";
	const activeTab = writable<Tab>("orders");
	$: goto = racefreeGoto(disposer);

	$: ({ plugins, supplier, assignedPublishers, availablePublishers } = data);

	$: filteredAssigned = searchQuery
		? assignedPublishers.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
		: assignedPublishers;

	$: filteredAvailable = searchQuery
		? availablePublishers.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
		: availablePublishers;

	$: t = $LL.order_list_page;

	let confirmationPublisher = "";

	// #region dialog
	const dialog = createDialog(defaultDialogConfig);
	const {
		states: { open: dialogOpen }
	} = dialog;

	const confirmationDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: confirmationDialogOpen }
	} = confirmationDialog;
	// #endregion dialog

	const handleUpdateSupplier = async (_data: Partial<Supplier>) => {
		const db = await getDb(app);
		const data = { ...stripNulls(supplier), ..._data };
		await upsertSupplier(db, data);
		dialogOpen.set(false);
	};

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		/**@TODO replace randomId with incremented id */
		// get latest/biggest id and increment by 1

		const db = await getDb(app);

		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createReconciliationOrder(db, id, event.detail.supplierOrderIds);
		goto(appPath("reconcile", id));
	}

	const handleAssignPublisher = (publisher: string) => async () => {
		const db = await getDb(app);
		await associatePublisher(db, supplier.id, publisher);
	};

	const handleUnassignPublisher = (publisher: string) => async () => {
		const db = await getDb(app);
		await removePublisherFromSupplier(db, supplier.id, publisher);
	};
	async function handleDownload(event: CustomEvent<{ supplierOrderId: number }>) {
		const db = await getDb(app);
		const lines = await getPlacedSupplierOrderLines(db, [event.detail.supplierOrderId]);

		const generatedLines = generateLinesForDownload(lines[0]?.customerId, lines[0]?.orderFormat, lines);

		downloadAsTextFile(generatedLines, `${event.detail.supplierOrderId}-${lines[0]?.supplier_name}-${lines[0]?.orderFormat}`);
	}
</script>

<Page title={t.details.supplier_page()} view="orders/suppliers/id" {app} {plugins}>
	<div slot="main" class="h-full w-full">
		<div class="flex h-full flex-col gap-y-10 px-4 max-md:overflow-y-auto md:flex-row md:divide-x">
			<div class="min-w-fit md:basis-96 md:overflow-y-auto">
				<div class="card h-full">
					<div class="card-body gap-y-2 p-0">
						<div class="sticky top-0 flex flex-col gap-y-2 bg-base-100 pb-3">
							<div class="flex flex-row items-center justify-between gap-y-2 md:flex-col md:items-start">
								<h2 class="prose">#{supplier?.id}</h2>
							</div>
						</div>

						{#if supplier}
							<dl class="flex flex-col">
								<div class="flex w-full flex-col gap-y-4 py-6">
									<div class="flex w-full flex-wrap justify-between gap-y-4 md:flex-col">
										<div class="max-w-96 flex flex-col gap-y-4">
											<div class="flex gap-x-3">
												<dt>
													<span class="sr-only">{t.details.supplier_name()}</span>
													<UserCircle aria-hidden="true" class="h-6 w-5 text-gray-400" />
												</dt>
												<dd class="truncate">{supplier.name}</dd>
											</div>

											<div class="flex gap-x-3">
												<dt>
													<span class="sr-only">{t.details.supplier_email()}</span>
													<Mail aria-hidden="true" class="h-6 w-5 text-gray-400" />
												</dt>
												<dd class="truncate">{supplier.email || "N/A"}</dd>
											</div>

											<div class="flex gap-x-3">
												<dt>
													<span class="sr-only">{t.details.supplier_address()}</span>
													<Mail aria-hidden="true" class="h-6 w-5 text-gray-400" />
												</dt>
												<dd class="truncate">{supplier.address || "N/A"}</dd>
											</div>

											<div class="flex gap-x-3">
												<dt>
													<span class="sr-only">{t.details.supplier_customerId()}</span>
													<Mail aria-hidden="true" class="h-6 w-5 text-gray-400" />
												</dt>
												<dd class="truncate">{supplier.customerId || "N/A"}</dd>
											</div>

											<div class="flex gap-x-3">
												<dt>
													<span class="sr-only">{t.details.supplier_orderFormat()}</span>
													<Download aria-hidden="true" class="h-6 w-5 text-gray-400" />
												</dt>
												<dd class="truncate">{supplier.orderFormat || "N/A"}</dd>
											</div>
										</div>
									</div>

									<div class="w-full pr-2">
										<button
											class="btn-secondary btn-outline btn-xs btn w-full"
											type="button"
											aria-label="Edit supplier details"
											on:click={() => dialogOpen.set(true)}
										>
											<PencilLine aria-hidden size={16} />
										</button>
									</div>
								</div>
							</dl>

							<div class="card-actions border-t py-6 md:mb-20">
								<a href={appPath("suppliers", supplier.id, "new-order")} class="btn-secondary btn-outline btn-sm btn" type="button">
									{t.labels.create_new_order()}
									<Plus aria-hidden size={20} />
								</a>
							</div>
						{/if}
					</div>
				</div>
			</div>
			<div class="mb-20 flex h-full w-full flex-col gap-y-6">
				<!-- Tab Navigation -->
				<div class="border-b border-gray-200">
					<nav class="-mb-px flex gap-x-8 px-4">
						<button
							class="border-b-2 py-2 text-sm font-medium transition-colors {$activeTab === 'orders' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
							on:click={() => activeTab.set("orders")}
						>
							Orders
						</button>
						<button
							class="border-b-2 py-2 text-sm font-medium transition-colors {$activeTab === 'publishers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
							on:click={() => activeTab.set("publishers")}
						>
							Assigned Publishers
						</button>
					</nav>
				</div>

				<!-- Orders Tab -->
				{#if $activeTab === "orders"}
					<div class="mb-20 h-full overflow-x-auto">
						<div class="h-full">
							<OrderedTable orders={data.orders} on:reconcile={handleReconcile} on:download={handleDownload} />
						</div>
					</div>
				{/if}

					<!-- Assigned Publishers Tab -->
					{#if $activeTab === "publishers"}
						<div class="flex h-full w-full flex-col pb-20 md:pb-0">
							<div class="sticky top-0 z-20 bg-white p-4">
								<div class="flex items-center gap-2">
									<input
										type="text"
										placeholder="Search publishers..."
										bind:value={searchQuery}
										class="input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
									/>
									{#if searchQuery}
										<button on:click={() => (searchQuery = "")} class="btn-xs btn-circle btn" aria-label="Clear search">✕</button>
									{/if}
								</div>
							</div>

							<div class="flex min-h-0 flex-1 overflow-hidden">
								<div class="flex min-w-0 flex-1 flex-col border-r border-gray-200">
									<div class="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
										<div class="flex items-center gap-2">
											<h3 class="text-base font-semibold text-gray-900">Assigned Publishers</h3>
											<span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{filteredAssigned.length}</span>
										</div>
									</div>
									<div class="min-h-0 flex-1 overflow-y-auto">
										{#each filteredAssigned as publisher}
											<div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 hover:bg-gray-50">
												<span class="truncate text-sm font-medium text-gray-900">{publisher}</span>
												<button on:click={handleUnassignPublisher(publisher)} class="btn-ghost btn-outline btn-xs btn whitespace-nowrap rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
													{t.labels.remove_publisher()}
												</button>
											</div>
										{/each}
										{#if filteredAssigned.length === 0}
											<div class="px-4 py-8 text-center text-sm text-gray-500">
												{searchQuery ? "No matching assigned publishers" : "No assigned publishers"}
											</div>
										{/if}
									</div>
								</div>

								<div class="flex min-w-0 flex-1 flex-col">
									<div class="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
										<div class="flex items-center gap-2">
											<h3 class="text-base font-semibold text-gray-900">Available Publishers</h3>
											<span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{filteredAvailable.length}</span>
										</div>
									</div>
									<div class="min-h-0 flex-1 overflow-y-auto">
										{#each filteredAvailable as pub}
											<div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 hover:bg-gray-50">
												<span class="flex items-center gap-2 truncate text-sm font-medium text-gray-900">
													{pub.name}
													{#if pub.supplierName}
														<span
															class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 max-w-[120px] truncate"
															title={`Currently assigned to ${pub.supplierName}`}
															>
																{pub.supplierName}
															</span>
													{/if}
												</span>
												<button
													on:click={pub.supplierName
														? () => {
																confirmationPublisher = pub.name;
																confirmationDialogOpen.set(true);
															}
														: handleAssignPublisher(pub.name)}
													class="btn-primary btn-xs btn whitespace-nowrap rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
												>
													{pub.supplierName ? t.labels.reassign_publisher() : t.labels.add_to_supplier()}
												</button>
											</div>
										{/each}
										{#if filteredAvailable.length === 0}
											<div class="px-4 py-8 text-center text-sm text-gray-500">
												{searchQuery ? "No matching available publishers" : "No available publishers"}
											</div>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{/if}
			</div>
		</div>
	</div>
</Page>

<PageCenterDialog {dialog} title="" description="">
	<SupplierMetaForm
		heading="Update supplier details"
		saveLabel="Save"
		data={defaults(stripNulls(supplier), zod(supplierSchema($LL)))}
		options={{
			SPA: true,
			validators: zod(supplierSchema($LL)),
			onUpdate: ({ form }) => {
				if (form.valid) {
					handleUpdateSupplier(form.data);
				}
			}
		}}
		formatList={orderFormats}
		onCancel={() => dialogOpen.set(false)}
	/>
</PageCenterDialog>

<ConfirmDialog
	dialog={confirmationDialog}
	title={t.dialogs.reassign_publisher.title()}
	description={t.dialogs.reassign_publisher.description({ publisher: confirmationPublisher, supplier: supplier.name })}
	labels={{
		confirm: "Confirm",
		cancel: "Cancel"
	}}
	onConfirm={() => {
		handleAssignPublisher(confirmationPublisher)();
		confirmationDialogOpen.set(false);
	}}
	onCancel={() => confirmationDialogOpen.set(false)}
/>

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
