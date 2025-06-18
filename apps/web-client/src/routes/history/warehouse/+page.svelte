<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Library from "$lucide/library";
	import Percent from "$lucide/percent";
	import { invalidate } from "$app/navigation";

	import { entityListView, testId } from "@librocco/shared";
	import LL from "@librocco/shared/i18n-svelte";

	import type { PageData } from "./$types";

	import * as stockCache from "$lib/db/cr-sqlite/stock_cache";

	import HistoryPage from "$lib/controllers/HistoryPage.svelte";

	import { appPath } from "$lib/paths";
	import { PlaceholderDots } from "$lib/components";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload when warehouse data changes
		disposer = data.dbCtx?.rx?.onRange(["warehouse"], () => invalidate("warehouse:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});

	$: ({ warehouses, plugins } = data);
	$: db = data.dbCtx?.db;

	$: ({ warehouseTotals } = stockCache);

	$: t = $LL.history_page.warehouse_tab;

	let initialised = false;
	$: initialised = Boolean(data);
</script>

<HistoryPage view="history/warehouse" {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col divide-y">
		{#if !initialised}
			<div class="flex grow justify-center">
				<div class="mx-auto translate-y-1/2">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			</div>
		{:else}
			<!-- Start entity list contaier -->

			<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
			<ul class={testId("entity-list-container")} data-view={entityListView("warehouse-list")}>
				<!-- Start entity list -->
				{#each warehouses as warehouse}
					{@const displayName = warehouse.displayName || warehouse.id}
					{@const href = appPath("history/warehouse", warehouse.id)}
					{@const warehouseDiscount = warehouse.discount}

					<div class="group entity-list-row">
						<div class="flex flex-col gap-y-2 self-start">
							<a {href} class="entity-list-text-lg text-base-content hover:underline focus:underline">{displayName}</a>

							<div class="flex flex-col gap-2 sm:flex-row">
								<div class="flex w-32 items-center gap-x-1">
									<Library class="text-base-content" size={20} />

									{#await $warehouseTotals}
										<PlaceholderDots />
									{:then warehouseTotals}
										<span class="entity-list-text-sm text-base-content">
											{t.stats.books({ no_of_books: warehouseTotals.get(warehouse.id) })}
										</span>
									{/await}
								</div>

								{#if warehouseDiscount}
									<div class="flex items-center gap-x-1">
										<div class="border border-base-content p-[1px]">
											<Percent class="text-base-content" size={14} />
										</div>
										<span class="entity-list-text-sm text-base-content">{warehouseDiscount}% {t.stats.discount()}</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
				<!-- End entity list -->
			</ul>
			<!-- End entity list contaier -->
		{/if}
	</div>
</HistoryPage>
