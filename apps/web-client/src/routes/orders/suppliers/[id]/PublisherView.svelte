<script lang="ts">
	import { createDialog } from "@melt-ui/svelte";

	import LL from "@librocco/shared/i18n-svelte";

	import type { PageData } from "./$types";

	import { defaultDialogConfig } from "$lib/components/Melt";
	import ConfirmDialog from "$lib/components/Dialogs/ConfirmDialog.svelte";

	import { associatePublisher, removePublisherFromSupplier } from "$lib/db/cr-sqlite/suppliers";
	import { SupplierPublisherTable, SupplierPublisherTableRow } from "$lib/components-new/SupplierPublisherList";

	import { app } from "$lib/app";
	import { getDb } from "$lib/app/db";

	export let data: PageData;

	let searchQuery = "";

	$: ({ supplier, assignedPublishers, availablePublishers } = data);

	$: filteredAssigned = searchQuery
		? assignedPublishers.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
		: assignedPublishers;

	$: filteredAvailable = searchQuery
		? availablePublishers.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
		: availablePublishers;

	$: t = $LL.order_list_page;

	let confirmationPublisher = "";
	const confirmationDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: confirmationDialogOpen }
	} = confirmationDialog;

	const handleAssignPublisher = (publisher: string) => async () => {
		const db = await getDb(app);
		await associatePublisher(db, supplier.id, publisher);
	};

	const handleUnassignPublisher = (publisher: string) => async () => {
		const db = await getDb(app);
		await removePublisherFromSupplier(db, supplier.id, publisher);
	};
</script>

<div class="mb-4 flex h-full w-full flex-col pb-4">
	<div class="sticky top-0 z-20 mb-4 bg-white px-5 pb-4">
		<div class="relative flex items-center gap-2">
			<div class="relative w-full">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
					/>
				</svg>
				<input
					type="text"
					placeholder="Search publishers..."
					bind:value={searchQuery}
					class="h-9 w-full rounded border border-none border-gray-300 bg-white py-1 pl-9 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>
			{#if searchQuery}
				<button on:click={() => (searchQuery = "")} class="btn-xs btn-circle btn" aria-label="Clear search">✕</button>
			{/if}
		</div>
	</div>

	<div class="flex min-h-0 flex-1 overflow-hidden px-5 pb-5">
		<div class="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
			<div class="flex min-w-0 flex-1 flex-col border-gray-200">
				<SupplierPublisherTable
					showEmptyState={filteredAssigned.length === 0}
					emptyStateMessage={searchQuery ? "No matching assigned publishers" : "No assigned publishers"}
				>
					<svelte:fragment slot="title">Assigned Publishers</svelte:fragment>

					<span slot="badge" class="inline-flex items-center rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
						{filteredAssigned.length}
					</span>

					{#each filteredAssigned as publisher}
						<SupplierPublisherTableRow publisherName={publisher}>
							<button
								slot="action-button"
								on:click={handleUnassignPublisher(publisher)}
								class="h-5 whitespace-nowrap rounded border-0 bg-transparent px-1 text-[11px] font-medium text-gray-500 hover:bg-red-50 hover:!text-red-600"
							>
								Remove
							</button>
						</SupplierPublisherTableRow>
					{/each}
				</SupplierPublisherTable>
			</div>

			<SupplierPublisherTable
				showEmptyState={filteredAvailable.length === 0}
				emptyStateMessage={searchQuery ? "No matching available publishers" : "No available publishers"}
			>
				<svelte:fragment slot="title">Available Publishers</svelte:fragment>
				<span slot="badge" class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
					{filteredAvailable.length}
				</span>

				{#each filteredAvailable as pub}
					{#if pub.supplierName}
						<SupplierPublisherTableRow publisherName={pub.name}>
							<span
								slot="badge"
								class="inline-flex truncate rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800"
								title={`Currently assigned to ${pub.supplierName}`}
							>
								{pub.supplierName}
							</span>
							<button
								slot="action-button"
								on:click={() => {
									confirmationPublisher = pub.name;
									confirmationDialogOpen.set(true);
								}}
								class="hover:text-accent-foreground h-5 whitespace-nowrap rounded border border-gray-900 bg-white px-1 text-[11px] font-medium text-gray-900 hover:bg-[#00d3bb]"
							>
								Re-assign
							</button>
						</SupplierPublisherTableRow>
					{:else}
						<SupplierPublisherTableRow publisherName={pub.name}>
							<button
								slot="action-button"
								on:click={handleAssignPublisher(pub.name)}
								class="hover:text-accent-foreground h-5 whitespace-nowrap rounded border border-gray-900 bg-white px-1 text-[11px] font-medium text-gray-900 hover:bg-[#00d3bb]"
							>
								Add
							</button>
						</SupplierPublisherTableRow>
					{/if}
				{/each}
			</SupplierPublisherTable>
		</div>
	</div>
</div>

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
