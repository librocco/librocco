<script lang="ts">
	import Book from "$lucide/book";
	import Calendar from "$lucide/calendar";

	import { browser } from "$app/environment";
	import { page } from "$app/stores";

	import { Page } from "$lib/controllers";
	import { appHash } from "$lib/paths";

	import type { HistoryView } from "@librocco/shared";

	import type { DB } from "$lib/db/cr-sqlite/types";
	import type { PluginsInterface } from "$lib/plugins";

	$: tabs = [
		{
			icon: Calendar,
			label: "By Date",
			// Keep the date when switching from one dated tab to another.
			// We're doing this in browser only so as to not produce errors during static build.
			href: appHash("history/date", (browser && $page.params?.date) || "")
		},
		{
			icon: Book,
			label: "By ISBN",
			href: appHash("history/isbn")
		},
		{
			icon: Book,
			label: "Notes by date",
			// Keep the date when switching from one dated tab to another
			// We're doing this in browser only so as to not produce errors during static build.
			href: appHash("history/notes/date", (browser && $page.params?.date) || "")
		},
		{
			icon: Book,
			label: "by Warehouse",
			href: appHash("history/warehouse") // Keep the date when switching from one dated tab to another
		}
	];

	export let view: HistoryView;
	export let db: DB;
	export let plugins: PluginsInterface;
</script>

<Page title="History" {view} {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col">
		<div id="history-tabs" class="tabs tabs-bordered w-full py-4">
			{#each tabs as { label, icon, href }}
				{@const active = $page.url.hash.startsWith(href)}

				<a {href} class="tab gap-x-2 {active ? 'tab-active' : ''}">
					<svelte:component this={icon} size={20} />
					<span class="text-sm font-medium leading-5">{label}</span>
				</a>
			{/each}
		</div>

		<slot name="main" />
	</div>
</Page>

<style>
	@media print {
		#history-tabs {
			display: none;
		}
	}
</style>
