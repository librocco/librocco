<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import SupplierPublisherTable from "./SupplierPublisherTable.svelte";
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
	const unassignedPublishers = ["Publisher X", "Publisher Y", "Publisher Z"];
	const otherSuppliers = ["Publisher 1", "Publisher 2"];
	const emptyPublishers: string[] = [];

	function handleAction(event: CustomEvent<{ publisher: string }>) {
		console.log("Action clicked for:", event.detail.publisher);
	}
</script>

<Story name="Assigned Publishers">
	<SupplierPublisherTable publishers={assignedPublishers} on:action={handleAction}>
		<svelte:fragment slot="title">Assigned Publishers</svelte:fragment>
		<svelte:fragment slot="header-label">Publisher Name</svelte:fragment>
		<svelte:fragment slot="action-label" let:publisher>Remove Publisher</svelte:fragment>
	</SupplierPublisherTable>
</Story>

<Story name="Unassigned Publishers">
	<SupplierPublisherTable publishers={unassignedPublishers} on:action={handleAction}>
		<svelte:fragment slot="title">Unassigned Publishers</svelte:fragment>
		<svelte:fragment slot="header-label">Publisher Name</svelte:fragment>
		<svelte:fragment slot="action-label" let:publisher>Add to Supplier</svelte:fragment>
	</SupplierPublisherTable>
</Story>

<Story name="Other Suppliers">
	<SupplierPublisherTable publishers={otherSuppliers} on:action={handleAction}>
		<svelte:fragment slot="title">Other Supplier Publishers</svelte:fragment>
		<svelte:fragment slot="header-label">Publisher Name</svelte:fragment>
		<svelte:fragment slot="action-label" let:publisher>Reassign Publisher</svelte:fragment>
	</SupplierPublisherTable>
</Story>

<Story name="Empty State">
	<SupplierPublisherTable publishers={emptyPublishers} on:action={handleAction}>
		<svelte:fragment slot="title">Assigned Publishers</svelte:fragment>
		<svelte:fragment slot="header-label">Publisher Name</svelte:fragment>
		<svelte:fragment slot="action-label" let:publisher>Remove Publisher</svelte:fragment>
	</SupplierPublisherTable>
</Story>

<Story name="Custom Empty State">
	<SupplierPublisherTable publishers={emptyPublishers} on:action={handleAction}>
		<svelte:fragment slot="title">Custom Publishers</svelte:fragment>
		<svelte:fragment slot="header-label">Publisher Name</svelte:fragment>
		<svelte:fragment slot="action-label" let:publisher>Action</svelte:fragment>
		<svelte:fragment slot="empty-state">
			<tr>
				<td colspan="2" class="px-2 py-4 text-center text-blue-500"> No publishers found - custom message </td>
			</tr>
		</svelte:fragment>
	</SupplierPublisherTable>
</Story>
