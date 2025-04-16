<script lang="ts">
	import { Building, Plus, CopyPlus } from "lucide-svelte";

	import { page } from "$app/stores";

	import { Page } from "$lib/controllers";
	import { appPath } from "$lib/paths";

	import type { DB } from "$lib/db/cr-sqlite/types";
	import type { PluginsInterface } from "$lib/plugins";

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

	export let db: DB;
	export let plugins: PluginsInterface;

	export let handleCreateWarehouse = () => Promise.resolve();
</script>

<Page title={activeTab.label} view="inventory" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-4">
		<div class="flex w-full items-center justify-end p-4">
			<button on:click={handleCreateWarehouse} class="btn-primary btn-sm btn">
				<Plus size={20} aria-hidden />
				New warehouse
			</button>
		</div>

		<div class="flex h-full w-full flex-col">
			<div class="tabs-bordered tabs w-full">
				{#each tabs as { label, icon, href }}
					{@const active = $page.url.pathname.startsWith(href)}

					<a {href} class="tab gap-x-2 {active ? 'tab-active' : ''}">
						<svelte:component this={icon} size={20} />
						<span class="text-sm font-medium leading-5">{label}</span>
					</a>
					<!-- <a
							class="btn btn- flex gap-x-2 border-b py-4 {active ? 'border-primary text-primary select-none' : 'text-base-content'}"
							{href}
						> -->
				{/each}
			</div>

			<slot />
		</div>
	</div>
</Page>
