<script lang="ts">
	import { Edit, BarChart, Trash2 } from "lucide-svelte";

	import { Dropdown, EntityList, EntityListRow, PlaceholderBox } from "$lib/components";

	import { PROTO_PATHS } from "$lib/paths";

	interface Warehouse {
		id: string;
		displayName?: string;
		totalBooks?: number;
	}

	const warehouses: Warehouse[] = [
		{
			id: "warehouse-1",
			displayName: "New Warehouse",
			totalBooks: 0
		},
		{
			id: "warehouse-2",
			displayName: "New Warehouse (2)"
		},
		{
			id: "warehouse-3",
			totalBooks: 3
		}
	];
</script>

{#if !warehouses.length}
	<PlaceholderBox title="New warehouse" description="Get started by adding a new warehouse" class="center-absolute">
		<button class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
			><span class="text-green-50">New warehouse</span></button
		>
	</PlaceholderBox>
{:else}
	<EntityList>
		{#each warehouses as warehouse}
			{@const displayName = warehouse.displayName || warehouse.id}
			<EntityListRow {...warehouse} {displayName}>
				<svelte:fragment slot="actions">
					<!-- Inside 'flex justify-between' container, we want the following box (buttons) to be pushed to the end -->
					<div />

					<div class="flex items-center justify-end gap-3">
						<button class="rounded-md bg-teal-500 px-[17px] py-[9px]"
							><span class="text-sm font-medium leading-5 text-green-50">New note</span></button
						>

						<Dropdown>
							<button class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5"
								><Edit class="text-gray-400" size={20} /><span class="text-gray-700">Edit</span></button
							>
							<a
								href="{PROTO_PATHS.WAREHOUSES}/{warehouse.id}"
								class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5"
								><BarChart class="text-gray-400" size={20} /><span class="text-gray-700">View Stock</span></a
							>
							<button class="flex w-full items-center gap-2 bg-red-400 px-4 py-3 text-sm font-normal leading-5"
								><Trash2 class="text-white" size={20} /><span class="text-white">Delete</span></button
							>
						</Dropdown>
					</div>
				</svelte:fragment>
			</EntityListRow>
		{/each}
	</EntityList>
{/if}
