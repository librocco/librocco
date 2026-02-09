<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import Table from "./Table.svelte";
	import TableRow from "./TableRow.svelte";

	export const meta: Meta = {
		title: "Components / Table",
		component: Table
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	const orderData = [{ id: "order-1", orderId: "#2", supplierName: "BooksRUs", placed: "11/10/2025, 2:15:20 PM" }];
</script>

<Story name="Supplier Page > Orders">
	<div class="max-w-xl">
		<Table columnWidths={["3", "3", "6"]}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left align-middle text-xs">Order ID</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left align-middle text-xs">Supplier Name</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left align-middle text-xs">Placed</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each orderData as row}
					<TableRow>
						<td class="px-4 py-2 text-sm">{row.orderId}</td>
						<td class="px-4 py-2 text-sm">{row.supplierName}</td>
						<td class="px-4 py-2 text-sm">{row.placed}</td>
					</TableRow>
				{/each}
			</svelte:fragment>
		</Table>
	</div>
</Story>

<Story name="Supplier Page > Orders (Empty State)">
	<div class="max-w-xl">
		<Table columnWidths={["3", "3", "6"]} showEmptyState={true}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Order ID</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Supplier Name</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Placed</th>
			</svelte:fragment>

			<svelte:fragment slot="empty">No orders found</svelte:fragment>
		</Table>
	</div>
</Story>
