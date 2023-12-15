<script lang="ts">
	import { map } from "rxjs";
	import { Edit, Table2, Trash2 } from "lucide-svelte";

	import { filter } from "@librocco/shared";

	import { goto } from "$app/navigation";

	import { DropdownWrapper, EntityList, EntityListRow, PlaceholderBox } from "$lib/components";

	import { getDB } from "$lib/db";

	import { noteToastMessages, toastSuccess } from "$lib/toasts";

	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";

	const db = getDB();

	const warehouseListCtx = { name: "[WAREHOUSE_LIST]", debug: false };
	const warehouseList = readableFromStream(
		warehouseListCtx,
		db
			?.stream()
			.warehouseMap(warehouseListCtx)
			/** @TODO we could probably wrap the Map to be ArrayLike (by having 'm.length' = 'm.size') */
			.pipe(map((m) => [...filter(m, ([warehouseId]) => !warehouseId.includes("0-all"))])),
		[]
	);

	const handleDeleteWarehouse = (warehouseId: string) => async () => {
		await db?.warehouse(warehouseId).delete();
		// TODO: There should be a 'Warehouse deleted' toast
		// toastSuccess(warehouseToastMessages("Warehouse").);
	};

	/**
	 * Handle create note is an `on:click` handler used to create a new inbound note in the provided warehouse.
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateNote = (warehouseId: string) => async () => {
		const note = await db?.warehouse(warehouseId).note().create();
		toastSuccess(noteToastMessages("Note").inNoteCreated);
		await goto(appPath("inbound", note._id));
	};
</script>

<!-- The Page layout is rendered by the parent (inventory) '+layout.svelte', with inbound and warehouse page rendering only their respective entity lists -->

{#if !$warehouseList.length}
	<PlaceholderBox title="New warehouse" description="Get started by adding a new warehouse" class="center-absolute">
		<button class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
			><span class="text-green-50">New warehouse</span></button
		>
	</PlaceholderBox>
{:else}
	<EntityList>
		{#each $warehouseList as [warehouseId, warehouse]}
			{@const displayName = warehouse.displayName || warehouseId}
			{@const totalBooks = warehouse.totalBooks}
			{@const href = appPath("warehouses", warehouseId)}

			<EntityListRow {displayName} {totalBooks}>
				<svelte:fragment slot="actions">
					<!-- Inside 'flex justify-between' container, we want the following box (buttons) to be pushed to the end -->
					<div />

					<div class="flex items-center justify-end gap-3">
						<button on:click={handleCreateNote(warehouseId)} class="rounded-md bg-teal-500 px-[17px] py-[9px]"
							><span class="text-sm font-medium leading-5 text-green-50">New note</span></button
						>

						<DropdownWrapper let:separator let:item>
							<div
								{...item}
								use:item.action
								on:m-click={() => console.log("TODO: open warehouse edit modal")}
								class="data-[highlighted]:bg-gray-100 flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5"
							>
								<Edit class="text-gray-400" size={20} />
								<span class="text-gray-700">Edit</span>
							</div>

							<div {...separator} use:separator.action class="h-[1px] bg-gray-200 " />

							<a
								{href}
								{...item}
								use:item.action
								class="data-[highlighted]:bg-gray-100 flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5"
							>
								<Table2 class="text-gray-400" size={20} />
								<span class="text-gray-700">View Stock</span>
							</a>

							<div
								{...item}
								use:item.action
								on:m-click={handleDeleteWarehouse(warehouseId)}
								class="data-[highlighted]:bg-red-500 flex w-full items-center gap-2 bg-red-400 px-4 py-3 text-sm font-normal leading-5"
							>
								<Trash2 class="text-white" size={20} />
								<span class="text-white">Delete</span>
							</div>
						</DropdownWrapper>
					</div>
				</svelte:fragment>
			</EntityListRow>
		{/each}
	</EntityList>
{/if}
