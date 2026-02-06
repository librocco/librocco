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

	let selectedIds: Set<string> = new Set();

	function toggleSelection(id: string) {
		const newSelection = new Set(selectedIds);
		if (newSelection.has(id)) {
			newSelection.delete(id);
		} else {
			newSelection.add(id);
		}
		selectedIds = newSelection;
	}
</script>

<Story name="Supplier Page > Orders">
	<div class="max-w-xl">
		<Table columnWidths={["1", "2", "3", "6"]}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="min-w-6 w-auto px-4 py-3 text-left align-middle text-xs">
					<input type="checkbox" class="h-4 w-4 accent-[#422AD5]" />
				</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Order ID</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Supplier Name</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Placed</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each orderData as row}
					<TableRow selected={selectedIds.has(row.id)}>
						<td class="min-w-6 px-4 py-2 text-left align-middle">
							<input
								type="checkbox"
								checked={selectedIds.has(row.id)}
								on:change={() => toggleSelection(row.id)}
								class="h-4 w-4 accent-[#422AD5]"
							/>
						</td>
						<td class="px-4 py-2 text-sm">{row.orderId}</td>
						<td class="px-4 py-2 text-sm">{row.supplierName}</td>
						<td class="px-4 py-2 text-sm">{row.placed}</td>
					</TableRow>
				{/each}
			</svelte:fragment>
		</Table>
	</div>
</Story>
