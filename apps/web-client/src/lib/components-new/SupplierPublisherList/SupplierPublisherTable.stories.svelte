<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import SupplierPublisherTable from "./SupplierPublisherTable.svelte";
	import SupplierPublisherTableRow from "./SupplierPublisherTableRow.svelte";
	import SupplierPublisherTableStoryDecorator from "./SupplierPublisherTableStoryDecorator.svelte";

	export const meta: Meta = {
		title: "Supplier Publisher Table",
		component: SupplierPublisherTable,
		decorators: [() => ({ Component: SupplierPublisherTableStoryDecorator })]
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	const assignedPublishers = ["Publisher A", "Publisher B", "Publisher C"];
	const availablePublishers = [
		{ name: "Publisher 1", supplierName: "Supplier A" },
		{ name: "Publisher 2", supplierName: "Supplier B" },
		{ name: "Publisher X" },
		{ name: "Publisher Y" },
		{ name: "Publisher Z" }
	];
</script>

<Story name="Assigned Publishers">
	<SupplierPublisherTable>
		<svelte:fragment slot="title">Assigned Publishers</svelte:fragment>
		<span slot="badge" class="inline-flex items-center rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
			{assignedPublishers.length}
		</span>

		{#each assignedPublishers as publisher}
			<SupplierPublisherTableRow publisherName={publisher}>
				<button
					slot="action-button"
					class="h-5 whitespace-nowrap rounded border-0 bg-transparent px-1 text-[11px] font-medium text-gray-500 hover:bg-red-50 hover:!text-red-600"
				>
					Remove
				</button>
			</SupplierPublisherTableRow>
		{/each}
	</SupplierPublisherTable>
</Story>

<Story name="Available Publishers">
	<SupplierPublisherTable>
		<svelte:fragment slot="title">Available Publishers</svelte:fragment>
		<span slot="badge" class="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
			{availablePublishers.length}
		</span>

		{#each availablePublishers as { name, supplierName }}
			{#if supplierName}
				<SupplierPublisherTableRow publisherName={name}>
					<span
						slot="badge"
						class="inline-flex max-w-[100px] truncate rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800"
						title={`Currently assigned to ${supplierName}`}
					>
						{supplierName}
					</span>

					<button
						slot="action-button"
						class="h-5 whitespace-nowrap rounded border border-gray-900 bg-white px-1 text-[11px] font-medium text-gray-900 hover:bg-[#00d3bb] hover:text-accent-foreground"
					>
						Add
					</button>
				</SupplierPublisherTableRow>
			{:else}
				<SupplierPublisherTableRow publisherName={name}>
					<button
						slot="action-button"
						class="h-5 whitespace-nowrap rounded border border-gray-900 bg-white px-1 text-[11px] font-medium text-gray-900 hover:bg-[#00d3bb] hover:text-accent-foreground"
					>
						Re-assign
					</button>
				</SupplierPublisherTableRow>
			{/if}
		{/each}
	</SupplierPublisherTable>
</Story>

<Story name="Empty State">
	<SupplierPublisherTable showEmptyState={true} emptyStateMessage="No assigned publishers">
		<svelte:fragment slot="title">Assigned Publishers</svelte:fragment>
		<span slot="badge" class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
			0
		</span>
	</SupplierPublisherTable>
</Story>

<Story name="Custom Empty State">
	<SupplierPublisherTable showEmptyState={true}>
		<svelte:fragment slot="title">Custom Publishers</svelte:fragment>
		<span slot="badge" class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
			0
		</span>
		<svelte:fragment slot="empty-state">
			<div class="py-8 px-3 text-center text-sm text-blue-500">No publishers found - custom message</div>
		</svelte:fragment>
	</SupplierPublisherTable>
</Story>
