<!-- * Note: this layout is used by `warehouses|inbound/+page.svelte` but the individual entity pages 
 * /.../[id] below break out of it by using @ in their name-->

<script lang="ts">
	import { Building, Plus, CopyPlus } from "lucide-svelte";

	import { page } from "$app/stores";
	import { goto } from "$lib/utils/navigation";

	import { ExtensionAvailabilityToast, Page } from "$lib/components";

	import { createOutboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import { getWarehouseIdSeq, upsertWarehouse } from "$lib/db/cr-sqlite/warehouse";

	import { appPath } from "$lib/paths";

	import type { LayoutData } from "./$types";

	export let data: LayoutData;

	// We could also reference these from central links?
	// TODO: labels to dictionary
	$: tabs = [
		{
			icon: Building,
			label: "Warehouses",
			href: appPath("warehouses")
		},
		{
			icon: CopyPlus,
			label: "Inbound",
			href: appPath("inbound")
		}
	];

	$: db = data.dbCtx?.db;

	$: activeTab = tabs.find(({ href }) => $page.url.pathname.startsWith(href));

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateOutboundNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);
		await goto(appPath("outbound", id));
	};

	/**
	 * Handle create warehouse is an `on:click` handler used to create a new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateWarehouse = async () => {
		const id = await getWarehouseIdSeq(db);
		await upsertWarehouse(db, { id });

		await goto(appPath("warehouses", id));
	};

	const handleSearch = async () => await goto(appPath("stock"));
</script>

<Page title={activeTab.label} {handleCreateOutboundNote} {handleSearch}>
	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-end">
			<button on:click={handleCreateWarehouse} class="button button-white">
				<span><Plus size={20} /></span>
				<span class="button-text">New warehouse</span>
			</button>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<div class="flex h-full w-full flex-col overflow-hidden">
			<div class="flex flex-shrink-0 gap-x-8 border-b border-gray-300 px-6">
				{#each tabs as { label, icon, href }}
					{@const active = $page.url.pathname.startsWith(href)}

					<a {href} class="flex gap-x-2 py-4 {active ? 'select-none border-b border-indigo-600 text-indigo-500' : 'text-gray-500'}">
						<svelte:component this={icon} size={20} />
						<span class="text-sm font-medium leading-5">{label}</span>
					</a>
				{/each}
			</div>

			<slot />
		</div>
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast plugins={data.plugins} />
	</svelte:fragment>
</Page>
