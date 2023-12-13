<script lang="ts">
	import { Building, Plus, Search, CopyPlus } from "lucide-svelte";

	import { base } from "$app/paths";
	import { page } from "$app/stores";

	import { Page } from "$lib/components";

	const tabs = [
		{
			icon: Building,
			label: "Warehouses",
			href: `${base}/proto/inventory/warehouses`
		},
		{
			icon: CopyPlus,
			label: "Inbound",
			href: `${base}/proto/inventory/inbound`
		}
	];
</script>

<!-- The existence of id param indicates we're either on 'warehouses/[...id]' or 'inbound/[...id]' page (both of which render the layout on their own) -->
{#if $page.params.id}
	<slot />
{:else}
	<Page>
		<svelte:fragment slot="topbar" let:iconProps let:inputProps>
			<Search {...iconProps} />
			<input placeholder="Search" {...inputProps} />
		</svelte:fragment>

		<svelte:fragment slot="heading">
			<div class="flex w-full items-center justify-between">
				<h1 class="text-2xl font-bold leading-7 text-gray-900">Inventory</h1>
				<button class="flex items-center gap-2 rounded-md border border-gray-300 bg-white py-[9px] pl-[15px] pr-[17px]">
					<span><Plus size={20} /></span>
					<span class="text-sm font-medium leading-5 text-gray-700">New warehouse</span>
				</button>
			</div>
		</svelte:fragment>

		<svelte:fragment slot="main">
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
		</svelte:fragment>
	</Page>
{/if}
