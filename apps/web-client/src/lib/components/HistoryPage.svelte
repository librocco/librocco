<script lang="ts">
	import { Book, Calendar, Search } from "lucide-svelte";

	import { historyView, type HistoryView } from "@librocco/shared";

	import { goto } from "$app/navigation";
	import { page } from "$app/stores";

	import Page from "$lib/components/Page.svelte";

	import { appPath } from "$lib/paths";

	$: tabs = [
		{
			icon: Calendar,
			label: "By Date",
			href: appPath("history/date", $page.params?.date || ""), // Keep the date when switching from one dated tab to another
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
			href: appPath("history/notes", $page.params?.date || ""), // Keep the date when switching from one dated tab to another
			linkto: historyView("history/notes")
		}
	];

	export let view: HistoryView;
</script>

<Page {view} loaded={true}>
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
