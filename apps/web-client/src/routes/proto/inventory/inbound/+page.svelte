<script lang="ts">
	import { Trash } from "lucide-svelte";

	import { Badge, BadgeColor } from "@librocco/ui/Badge";

	import { base } from "$app/paths";

	import { EntityList, EntityListRow, PlaceholderBox } from "$lib/components";

	import { generateUpdatedAtString } from "$lib/utils/time";

	interface Note {
		id: string;
		displayName?: string;
		updatedAt?: Date;
		totalBooks?: number;
		warehouse: {
			id: string;
			displayName?: string;
		};
	}
	const notes: Note[] = [
		{
			id: "note-1",
			displayName: "New Note",
			updatedAt: new Date(),
			totalBooks: 0,
			warehouse: {
				id: "warehouse-1",
				displayName: "Warehouse 1"
			}
		},
		{
			id: "note-2",
			displayName: "New Note (2)",
			warehouse: {
				id: "warehouse-2"
			}
		},
		{
			id: "note-3",
			updatedAt: new Date(),
			totalBooks: 3,
			warehouse: {
				id: "warehouse-3"
			}
		}
	];
</script>

{#if !notes.length}
	<PlaceholderBox
		title="No open notes"
		description="Get started by adding a new note with the appropriate warehouse"
		class="center-absolute"
	>
		<a
			href="{base}/proto/inventory/warehouses"
			class="mx-auto inline-block items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
			><span class="text-green-50">Back to warehouses</span></a
		>
	</PlaceholderBox>
{:else}
	<EntityList>
		{#each notes as note}
			{@const warehouseName = note.warehouse.displayName || note.warehouse.id}
			{@const noteName = note.displayName || note.id}
			{@const displayName = `${warehouseName} / ${noteName}`}
			{@const updatedAt = note.updatedAt || undefined}
			{@const href = `${base}/proto/inventory/inbound/${note.id}`}

			<EntityListRow {...note} {displayName}>
				<svelte:fragment slot="actions">
					{#if updatedAt}
						<Badge label="Last updated: {generateUpdatedAtString(updatedAt)}" color={BadgeColor.Success} />
					{:else}
						<!-- Inside 'flex justify-between' container, we want the following box (buttons) to be pushed to the end, even if there's no badge -->
						<div />
					{/if}

					<div class="flex items-center justify-end gap-3">
						<a {href} class="rounded-md bg-pink-50 px-[17px] py-[9px]"
							><span class="text-sm font-medium leading-5 text-pink-700">Edit</span></a
						>
						<button class="rounded-md border border-gray-300 bg-white py-[9px] pl-[17px] pr-[15px]"
							><Trash class="border-gray-500" size={20} /></button
						>
					</div>
				</svelte:fragment>
			</EntityListRow>
		{/each}
	</EntityList>
{/if}
