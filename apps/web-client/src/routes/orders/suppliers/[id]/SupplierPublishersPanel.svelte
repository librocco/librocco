<script lang="ts">
	import { createDialog } from "@melt-ui/svelte";

	import LL from "@librocco/shared/i18n-svelte";

	import { defaultDialogConfig } from "$lib/components/Melt";
	import ConfirmDialog from "$lib/components/Dialogs/ConfirmDialog.svelte";
	import { SupplierPublisherTable, SupplierPublisherTableRow } from "$lib/components-new/SupplierPublisherList";

	type AvailablePublisher = {
		name: string;
		supplierName?: string;
	};

	export let supplierName: string;
	export let assignedPublishers: string[];
	export let availablePublishers: AvailablePublisher[];
	export let onAssignPublisher: (publisher: string) => void | Promise<void>;
	export let onUnassignPublisher: (publisher: string) => void | Promise<void>;

	let searchQuery = "";

	$: filteredAssigned = searchQuery
		? assignedPublishers.filter((publisher) => publisher.toLowerCase().includes(searchQuery.toLowerCase()))
		: assignedPublishers;

	$: filteredAvailable = searchQuery
		? availablePublishers.filter((publisher) => publisher.name.toLowerCase().includes(searchQuery.toLowerCase()))
		: availablePublishers;

	$: t = $LL.order_list_page;

	let confirmationPublisher = "";
	const confirmationDialog = createDialog(defaultDialogConfig);
	const {
		states: { open: confirmationDialogOpen }
	} = confirmationDialog;

	const publisherRowTestId = (column: "assigned" | "available", publisherName: string): string =>
		`publisher-row-${column}-${publisherName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")}`;
</script>

<div class="mb-4 flex min-h-0 w-full flex-1 flex-col pb-4">
	<div class="sticky top-0 z-20 mb-4 bg-base-100 px-5 pb-4">
		<div class="relative flex items-center gap-2">
			<div class="relative w-full">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/50"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
					/>
				</svg>
				<input
					type="text"
					placeholder={t.placeholders.search_publishers()}
					bind:value={searchQuery}
					class="h-9 w-full rounded border border-base-300 bg-base-100 py-1 pl-9 pr-3 text-sm text-base-content placeholder:text-base-content/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>
			{#if searchQuery}
				<button on:click={() => (searchQuery = "")} class="btn-xs btn-circle btn" aria-label={t.aria.clear_search()}>✕</button>
			{/if}
		</div>
	</div>

	<div class="flex min-h-0 flex-1 overflow-hidden px-5 pb-5">
		<div class="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
			<div data-testid="publisher-panel-assigned" class="flex min-w-0 flex-1 flex-col border-gray-200">
				<SupplierPublisherTable
					showEmptyState={filteredAssigned.length === 0}
					emptyStateMessage={searchQuery ? t.placeholders.no_matching_assigned_publishers() : t.placeholders.no_assigned_publishers()}
				>
					<svelte:fragment slot="title">{t.tabs.assigned_publishers()}</svelte:fragment>

					<span
						slot="badge"
						data-testid="publisher-count-assigned"
						class="inline-flex items-center rounded-full bg-base-content px-2 py-0.5 text-[10px] font-medium text-base-100"
					>
						{filteredAssigned.length}
					</span>

					{#each filteredAssigned as publisher}
						<SupplierPublisherTableRow publisherName={publisher} testId={publisherRowTestId("assigned", publisher)}>
							<button
								slot="action-button"
								on:click={() => onUnassignPublisher(publisher)}
								class="h-5 whitespace-nowrap rounded border-0 bg-transparent px-1 text-[11px] font-medium text-base-content/60 transition-colors hover:bg-error/10 hover:!text-error"
							>
								{t.labels.remove()}
							</button>
						</SupplierPublisherTableRow>
					{/each}
				</SupplierPublisherTable>
			</div>

			<div data-testid="publisher-panel-available" class="flex min-w-0 flex-1 flex-col">
				<SupplierPublisherTable
					showEmptyState={filteredAvailable.length === 0}
					emptyStateMessage={searchQuery ? t.placeholders.no_matching_available_publishers() : t.placeholders.no_available_publishers()}
				>
					<svelte:fragment slot="title">{t.table.unassigned_publishers()}</svelte:fragment>
					<span
						slot="badge"
						data-testid="publisher-count-available"
						class="inline-flex items-center rounded-full bg-base-200 px-2 py-0.5 text-[10px] font-medium text-base-content/70"
					>
						{filteredAvailable.length}
					</span>

					{#each filteredAvailable as publisher}
						{#if publisher.supplierName}
							<SupplierPublisherTableRow publisherName={publisher.name} testId={publisherRowTestId("available", publisher.name)}>
								<span
									slot="badge"
									class="inline-flex truncate rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800"
									title={t.placeholders.currently_assigned_to({ supplierName: publisher.supplierName })}
								>
									{publisher.supplierName}
								</span>
								<button
									slot="action-button"
									on:click={() => {
										confirmationPublisher = publisher.name;
										confirmationDialogOpen.set(true);
									}}
									class="h-5 whitespace-nowrap rounded border border-base-content/50 bg-base-100 px-1 text-[11px] font-medium text-base-content transition-colors hover:bg-accent hover:text-accent-content"
								>
									{t.labels.reassign()}
								</button>
							</SupplierPublisherTableRow>
						{:else}
							<SupplierPublisherTableRow publisherName={publisher.name} testId={publisherRowTestId("available", publisher.name)}>
								<button
									slot="action-button"
									on:click={() => onAssignPublisher(publisher.name)}
									class="h-5 whitespace-nowrap rounded border border-base-content/50 bg-base-100 px-1 text-[11px] font-medium text-base-content transition-colors hover:bg-accent hover:text-accent-content"
								>
									{t.labels.add()}
								</button>
							</SupplierPublisherTableRow>
						{/if}
					{/each}
				</SupplierPublisherTable>
			</div>
		</div>
	</div>
</div>

<ConfirmDialog
	dialog={confirmationDialog}
	title={t.dialogs.reassign_publisher.title()}
	description={t.dialogs.reassign_publisher.description({ publisher: confirmationPublisher, supplier: supplierName })}
	labels={{
		confirm: $LL.common.actions.confirm(),
		cancel: $LL.common.actions.cancel()
	}}
	onConfirm={() => {
		onAssignPublisher(confirmationPublisher);
		confirmationDialogOpen.set(false);
	}}
	onCancel={() => confirmationDialogOpen.set(false)}
/>
