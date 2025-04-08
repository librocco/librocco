<script lang="ts">
	import { Building, Plus, CopyPlus } from "lucide-svelte";

	import type { PluginsInterface } from "$lib/plugins";

	import { page } from "$app/stores";

	import { ExtensionAvailabilityToast, Page } from "$lib/components";

	import { appPath } from "$lib/paths";

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

	$: activeTab = tabs.find(({ href }) => $page.url.pathname.startsWith(href));

	export let plugins: PluginsInterface;

	export let handleSearch: (e: Event) => void;
	export let handleCreateWarehouse = () => Promise.resolve();
	export let handleCreateOutboundNote: () => (void | Promise<void>) | undefined = undefined;
</script>

<Page title={activeTab.label} {handleCreateOutboundNote} {handleSearch} view="inventory">
	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-end">
			<button on:click={handleCreateWarehouse} class="button button-white">
				<span><Plus size={20} /></span>
				<span class="button-text">New warehouse</span>
			</button>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<div class="flex h-full w-full flex-col">
			<div class="flex gap-x-8 border-b border-gray-300 px-6">
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

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast {plugins} />
	</svelte:fragment>
</Page>
