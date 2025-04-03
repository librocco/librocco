<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade } from "svelte/transition";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { defaults } from "sveltekit-superforms";
	import { zod } from "sveltekit-superforms/adapters";
	import { Edit, Table2, Trash2, Loader2 as Loader, Library, Percent } from "lucide-svelte";

	import { entityListView, testId } from "@librocco/shared";

	import { racefreeGoto } from "$lib/utils/navigation";

	import { DropdownWrapper, PlaceholderBox } from "$lib/components";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import { appPath } from "$lib/paths";

	import WarehouseForm from "$lib/forms/WarehouseForm.svelte";
	import WarehouseDeleteForm from "$lib/forms/WarehouseDeleteForm.svelte";
	import { warehouseSchema, type WarehouseFormSchema } from "$lib/forms/schemas";
	import PlaceholderDots from "$lib/components/Placeholders/PlaceholderDots.svelte";

	import type { PageData } from "./$types";
	import { createInboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import { deleteWarehouse, getWarehouseIdSeq, upsertWarehouse } from "$lib/db/cr-sqlite/warehouse";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload when warehouse data changes
		const disposer1 = rx.onRange(["warehouse"], () => invalidate("warehouse:list"));
		// Reload when a note gets committed (affecting stock)
		const disposer2 = rx.onRange(["note"], () => invalidate("warehouse:books"));
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data.dbCtx?.db;

	$: warehouses = data.warehouses;

	const handleDeleteWarehouse = (id: number) => async () => {
		await deleteWarehouse(db, id);
		open.set(false);
	};

	/**
	 * Handle create warehouse is an `on:click` handler used to create a new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateWarehouse = async () => {
		const id = await getWarehouseIdSeq(db);
		await upsertWarehouse(db, { id });

		// Unsubscribe from db changes to prevent invalidate and page load race
		disposer?.();
		await goto(appPath("warehouses", id));
	};

	/**
	 * Handle create note is an `on:click` handler used to create a new inbound note in the provided warehouse.
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateInboundNote = (warehouseId: number) => async () => {
		const id = await getNoteIdSeq(db);
		await createInboundNote(db, warehouseId, id);
		await goto(appPath("inbound", id));
	};

	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger, content, title, description },
		states: { open }
	} = dialog;

	let warehouseToEdit: WarehouseFormSchema | null = null;
	let warehouseToDelete: { id: number; displayName: string } = null;
	let dialogContent: (DialogContent & { type: "delete" | "edit" }) | null = null;

	let initialized = false;
	$: initialized = Boolean(db);
</script>

{#if !initialized}
	<div class="center-absolute">
		<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
	</div>
{:else}
	<!-- Start entity list contaier -->

	<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
	<ul class={testId("entity-list-container")} data-view={entityListView("warehouse-list")} data-loaded={true}>
		{#if !warehouses.length}
			<!-- Start entity list placeholder -->
			<PlaceholderBox title="New warehouse" description="Get started by adding a new warehouse" class="center-absolute">
				<button on:click={handleCreateWarehouse} class="button button-green"><span class="button-text">New warehouse</span></button>
			</PlaceholderBox>
			<!-- End entity list placeholder -->
		{:else}
			<!-- Start entity list -->
			{#each warehouses as { id, displayName, totalBooks, discount }}
				{@const href = appPath("warehouses", id)}

				<div class="entity-list-row group">
					<div class="flex flex-col gap-y-2 self-start">
						<a {href} class="entity-list-text-lg text-gray-900 hover:underline focus:underline">{displayName}</a>

						<div class="flex flex-col gap-2 sm:flex-row">
							<div class="entity-list-text-sm flex w-32 items-center gap-x-1 text-gray-500">
								<Library class="text-gray-700" size={18} />
								{#if totalBooks === -1}
									<PlaceholderDots />
								{:else}
									<span class="">{totalBooks}</span>
								{/if}
								books
							</div>

							{#if discount}
								<div class="flex items-center gap-x-1">
									<div class="border border-gray-700 p-[1px]">
										<Percent class="text-gray-700" size={14} />
									</div>
									<span class="entity-list-text-sm text-gray-500">{discount}% discount</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="entity-list-actions">
						<button on:click={handleCreateInboundNote(id)} class="button button-green">
							<span class="button-text"> New note </span>
						</button>

						<DropdownWrapper let:separator let:item>
							<div
								{...item}
								use:item.action
								use:melt={$trigger}
								on:m-click={() => {
									warehouseToEdit = { name: displayName, discount, id };
									dialogContent = {
										onConfirm: () => {},
										title: dialogTitle.editWarehouse(),
										description: dialogDescription.editWarehouse(),
										type: "edit"
									};
								}}
								on:m-keydown={() => {
									warehouseToEdit = { name: displayName, discount, id };
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

							<div {...separator} use:separator.action class="h-[1px] bg-gray-200"></div>

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
									warehouseToDelete = { id, displayName };
									dialogContent = {
										onConfirm: handleDeleteWarehouse(id),
										title: dialogTitle.delete(displayName),
										description: dialogDescription.deleteWarehouse(totalBooks),
										type: "delete"
									};
								}}
								on:m-keydown={() => {
									warehouseToDelete = { id, displayName };
									dialogContent = {
										onConfirm: handleDeleteWarehouse(id),
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
				</div>
			{/each}
			<!-- End entity list -->
		{/if}
	</ul>
	<!-- End entity list contaier -->
{/if}

{#if $open}
	{@const { type, title: dialogTitle, description: dialogDescription } = dialogContent};

	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}></div>
		{#if type === "edit"}
			<div
				class="fixed left-[50%] top-[50%] z-50 flex max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col gap-y-8 rounded-md bg-white px-4 py-6"
				use:melt={$content}
			>
				<h2 class="sr-only" use:melt={$title}>
					{dialogTitle}
				</h2>
				<p class="sr-only" use:melt={$description}>
					{dialogDescription}
				</p>
				<WarehouseForm
					data={defaults(warehouseToEdit, zod(warehouseSchema))}
					options={{
						SPA: true,
						dataType: "json",
						validators: zod(warehouseSchema),
						validationMethod: "submit-only",
						onUpdated: async ({ form }) => {
							const { id, name: displayName, discount } = form?.data;
							await upsertWarehouse(db, { id, displayName, discount });
							open.set(false);
						}
					}}
					onCancel={() => open.set(false)}
				/>
			</div>
		{:else}
			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<WarehouseDeleteForm
					{dialog}
					{dialogTitle}
					{dialogDescription}
					{...warehouseToDelete}
					options={{
						SPA: true,
						dataType: "json",
						validationMethod: "submit-only",
						onSubmit: handleDeleteWarehouse(warehouseToDelete.id)
					}}
				/>
			</div>
		{/if}
	</div>
{/if}
