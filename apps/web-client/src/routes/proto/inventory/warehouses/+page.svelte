<script lang="ts">
	import { firstValueFrom, map } from "rxjs";
	import { Edit, Table2, Trash2, Loader2 as Loader, Library, Percent } from "lucide-svelte";
	import { onMount } from "svelte";

	import { filter } from "@librocco/shared";

	import { goto } from "$app/navigation";

	import { DropdownWrapper, PlaceholderBox } from "$lib/components";

	import { getDB } from "$lib/db";

	import { noteToastMessages, toastSuccess } from "$lib/toasts";

	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";

	const db = getDB();

	const warehouseListCtx = { name: "[WAREHOUSE_LIST]", debug: false };
	const warehouseListStream = db
		?.stream()
		.warehouseMap(warehouseListCtx)
		/** @TODO we could probably wrap the Map to be ArrayLike (by having 'm.length' = 'm.size') */
		.pipe(map((m) => [...filter(m, ([warehouseId]) => !warehouseId.includes("0-all"))]));
	const warehouseList = readableFromStream(warehouseListCtx, warehouseListStream, []);

	let initialized = false;
	onMount(() => {
		firstValueFrom(warehouseListStream).then(() => (initialized = true));
	});

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

{#if !initialized}
	<div class="center-absolute">
		<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
	</div>
{:else if !$warehouseList.length}
	<PlaceholderBox title="New warehouse" description="Get started by adding a new warehouse" class="center-absolute">
		<button class="button button-green"><span class="button-text">New warehouse</span></button>
	</PlaceholderBox>
{:else}
	<ul class="entity-list-container">
		{#each $warehouseList as [warehouseId, warehouse]}
			{@const displayName = warehouse.displayName || warehouseId}
			{@const totalBooks = warehouse.totalBooks}
			{@const href = appPath("warehouses", warehouseId)}
			{@const warehouseDiscount = warehouse.discountPercentage}

			<li class="entity-list-row">
				<div class="max-w-1/2 w-full">
					<p class="entity-list-text-lg text-gray-900">{displayName}</p>

					<div class="flex items-center">
						<div class="flex w-32 items-center gap-x-1">
							<Library class="text-gray-700" size={20} />
							<span class="entity-list-text-sm text-gray-500">{totalBooks} books</span>
						</div>

						{#if warehouseDiscount}
							<div class="flex items-center gap-x-1">
								<div class="border border-gray-700 p-[1px]">
									<Percent class="text-gray-700" size={14} />
								</div>
								<span class="entity-list-text-sm text-gray-500">{warehouseDiscount}% discount</span>
							</div>
						{/if}
					</div>
				</div>

				<div class="max-w-1/2 flex w-full items-center justify-end gap-3">
					<button on:click={handleCreateNote(warehouseId)} class="button button-green"><span class="button-text">New note</span></button>

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
			</li>
		{/each}
	</ul>
{/if}
