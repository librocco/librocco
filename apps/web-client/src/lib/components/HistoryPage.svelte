<script lang="ts">
	import { Book, Calendar, Search } from "lucide-svelte";

	import { historyView, type HistoryView } from "@librocco/shared";

	import { goto } from "$lib/utils/navigation";
	import { page } from "$app/stores";

	import Page from "$lib/components/Page.svelte";

	import { appPath } from "$lib/paths";
	import { browser } from "$app/environment";

	$: tabs = [
		{
			icon: Calendar,
			label: "By Date",
			// Keep the date when switching from one dated tab to another.
			// We're doing this in browser only so as to not produce errors during static build.
			href: appPath("history/date", (browser && $page.params?.date) || ""),
			linkto: historyView("history/date")
		},
		{
			icon: Book,
			label: "By ISBN",
			href: appPath("history/isbn"),
			linkto: historyView("history/isbn")
		},
		{
			icon: Book,
			label: "Notes by date",
			// Keep the date when switching from one dated tab to another
			// We're doing this in browser only so as to not produce errors during static build.
			href: appPath("history/notes/date", (browser && $page.params?.date) || ""),
			linkto: historyView("history/notes")
		},
		{
			icon: Book,
			label: "by Warehouse",
			href: appPath("history/warehouse"), // Keep the date when switching from one dated tab to another
			linkto: historyView("history/warehouse")
		}
	];

	export let view: HistoryView;
	export let loaded = true;
</script>

<Page {view} {loaded}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		{#if $$slots.topbar}
			<slot name="topbar" {iconProps} {inputProps} />
		{:else}
			<Search {...iconProps} />
			<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="min-h-[48px]">
			<slot name="heading" />
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

			<slot name="main" />
		</div>
	</svelte:fragment>
</Page>
