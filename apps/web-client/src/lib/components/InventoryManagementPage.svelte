<script lang="ts">
	import { Building, Plus, Search, CopyPlus } from "lucide-svelte";

	import { entityListView } from "@librocco/shared";

	import { page } from "$app/stores";
	import { goto } from "$lib/utils/navigation";

	import { ExtensionAvailabilityToast, Page } from "$lib/components";

	import { appPath } from "$lib/paths";

	const tabs = [
		{
			icon: Building,
			label: "Warehouses",
			href: appPath("warehouses"),
			linkto: entityListView("warehouse-list")
		},
		{
			icon: CopyPlus,
			label: "Inbound",
			href: appPath("inbound"),
			linkto: entityListView("inbound-list")
		}
	];

	// TODO: revisit
	// if (!status) goto(appPath("settings"));

	export let handleCreateWarehouse = () => Promise.resolve();
</script>

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
				{#each tabs as { label, icon, href, linkto }}
					{@const active = $page.url.pathname.startsWith(href)}
					<svelte:element
						this={active ? "div" : "a"}
						class="flex gap-x-2 py-4 {active ? 'select-none border-b border-indigo-600 text-indigo-500' : 'text-gray-500'}"
						data-linkto={linkto}
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

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>
