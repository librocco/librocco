<script lang="ts">
	import { Building, Plus, Search, CopyPlus } from "lucide-svelte";

	import { NEW_WAREHOUSE } from "@librocco/db";

	import { page } from "$app/stores";
	import { goto } from "$app/navigation";

	import { Page } from "$lib/components";

	import { getDB } from "$lib/db";

	import { toastSuccess, warehouseToastMessages } from "$lib/toasts";

	import { appPath } from "$lib/paths";

	const tabs = [
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

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	/**
	 * Handle create warehouse is an `on:click` handler used to create a new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateWarehouse = async () => {
		const warehouse = await db.warehouse(NEW_WAREHOUSE).create();
		toastSuccess(warehouseToastMessages("Warehouse").warehouseCreated);
		await goto(appPath("warehouses", warehouse._id));
	};
</script>

<!-- The existence of id param indicates we're either on 'warehouses/[...id]' or 'inbound/[...id]' page (both of which render the layout on their own) -->
{#if $page.params.id}
	<slot />
{:else}
	<Page view="inventory" loaded={true}>
		<svelte:fragment slot="topbar" let:iconProps let:inputProps>
			<Search {...iconProps} />
			<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
		</svelte:fragment>

		<svelte:fragment slot="heading">
			<div class="flex w-full items-center justify-between">
				<h1 class="text-2xl font-bold leading-7 text-gray-900">Inventory</h1>
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
						<svelte:element
							this={active ? "div" : "a"}
							class="flex gap-x-2 py-4 {active ? 'select-none border-b border-indigo-600 text-indigo-500' : 'text-gray-500'}"
							{href}
						>
							<svelte:component this={icon} size={20} />
							<span class="text-sm font-medium leading-5">{label}</span>
						</svelte:element>
					{/each}
				</div>

				<slot />
			</div>
		</svelte:fragment>
	</Page>
{/if}
