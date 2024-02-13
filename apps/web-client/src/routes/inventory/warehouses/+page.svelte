<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { firstValueFrom, map } from "rxjs";
	import { Edit, Table2, Trash2, Loader2 as Loader, Library, Percent } from "lucide-svelte";

	import { filter } from "@librocco/shared";
	import { NEW_WAREHOUSE } from "@librocco/db";

	import { goto } from "$app/navigation";

	import { DropdownWrapper, PlaceholderBox, Dialog } from "$lib/components";

	import { getDB } from "$lib/db";

	import { noteToastMessages, warehouseToastMessages, toastError, toastSuccess } from "$lib/toasts";
	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";

	import WarehouseForm from "$lib/forms/WarehouseForm.svelte";
	import { warehouseSchema, type WarehouseFormData } from "$lib/forms/schemas";

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

	const handleDeleteWarehouse = (warehouseId: string, warehouseName: string) => async () => {
		await db?.warehouse(warehouseId).delete();
		toastSuccess(warehouseToastMessages(warehouseName).warehouseDeleted);
	};

	/**
	 * Handle create warehouse is an `on:click` handler used to create a new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateWarehouse = async () => {
		const warehouse = await db.warehouse(NEW_WAREHOUSE).create();
		toastSuccess(warehouseToastMessages("Warehouse").warehouseCreated);
		await goto(appPath("warehouses", warehouse._id));
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

	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger, content, title, description },
		states: { open }
	} = dialog;

	let editWarehouse: WarehouseFormData = null;
	let dialogContent: (DialogContent & { type: "delete" | "edit" }) | null = null;
</script>

<!-- The Page layout is rendered by the parent (inventory) '+layout.svelte', with inbound and warehouse page rendering only their respective entity lists -->

{#if !initialized}
	<div class="center-absolute">
		<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
	</div>
{:else if !$warehouseList.length}
	<PlaceholderBox title="New warehouse" description="Get started by adding a new warehouse" class="center-absolute">
		<button on:click={handleCreateWarehouse} class="button button-green"><span class="button-text">New warehouse</span></button>
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
							use:melt={$trigger}
							on:m-click={() => {
								editWarehouse = { name: warehouse.displayName, discount: warehouse.discountPercentage, id: warehouseId };
								dialogContent = {
									onConfirm: () => {},
									title: dialogTitle.editWarehouse(),
									description: dialogDescription.editWarehouse(),
									type: "edit"
								};
							}}
							on:m-keydown={() => {
								editWarehouse = { name: warehouse.displayName, discount: warehouse.discountPercentage, id: warehouseId };
								dialogContent = {
									onConfirm: () => {},
									title: dialogTitle.editWarehouse(),
									description: dialogDescription.editWarehouse(),
									type: "edit"
								};
							}}
							class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-gray-100"
						>
							<Edit class="text-gray-400" size={20} />
							<span class="text-gray-700">Edit</span>
						</div>

						<div {...separator} use:separator.action class="h-[1px] bg-gray-200 " />

						<a
							{href}
							{...item}
							use:item.action
							class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-gray-100"
						>
							<Table2 class="text-gray-400" size={20} />
							<span class="text-gray-700">View Stock</span>
						</a>

						<div
							{...item}
							use:item.action
							use:melt={$trigger}
							on:m-click={() => {
								dialogContent = {
									onConfirm: handleDeleteWarehouse(warehouseId, displayName),
									title: dialogTitle.delete(displayName),
									description: dialogDescription.deleteWarehouse(totalBooks),
									type: "delete"
								};
							}}
							on:m-keydown={() => {
								dialogContent = {
									onConfirm: handleDeleteWarehouse(warehouseId, displayName),
									title: dialogTitle.delete(displayName),
									description: dialogDescription.deleteWarehouse(totalBooks),
									type: "delete"
								};
							}}
							class="flex w-full items-center gap-2 bg-red-400 px-4 py-3 text-sm font-normal leading-5 data-[highlighted]:bg-red-500"
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

<div use:melt={$portalled}>
	{#if $open}
		{@const { type, onConfirm, title: dialogTitle, description: dialogDescription } = dialogContent};

		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }} />
		{#if type === "edit"}
			<div
				class="fixed left-[50%] top-[50%] z-50 flex max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col gap-y-8 rounded-md bg-white py-6 px-4"
				use:melt={$content}
			>
				<h2 class="sr-only" use:melt={$title}>
					{dialogTitle}
				</h2>
				<p class="sr-only" use:melt={$description}>
					{dialogDescription}
				</p>
				<WarehouseForm
					data={editWarehouse}
					options={{
						SPA: true,
						dataType: "json",
						validators: warehouseSchema,
						validationMethod: "submit-only",
						onUpdated: async ({ form }) => {
							const { id, name, discount } = form?.data;
							const warehouseInterface = db.warehouse(id);

							try {
								await warehouseInterface.setName({}, name);
								await warehouseInterface.setDiscount({}, discount);

								open.set(false);
								toastSuccess(warehouseToastMessages(name).warehouseUpdated);
							} catch (err) {
								toastError(`Error: ${err.message}`);
							}
						}
					}}
					onCancel={() => open.set(false)}
				/>
			</div>
		{:else}
			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<Dialog
					{dialog}
					type="delete"
					onConfirm={async (closeDialog) => {
						await onConfirm();
						closeDialog();
					}}
				>
					<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
					<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>
				</Dialog>
			</div>
		{/if}
	{/if}
</div>
