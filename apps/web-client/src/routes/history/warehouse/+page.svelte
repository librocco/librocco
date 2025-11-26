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
	import { PlaceholderDots, AsyncData, SkeletonList } from "$lib/components";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {});
	$: if (dbCtx) {
		disposer?.();
		disposer = dbCtx.rx.onRange(["warehouse"], () => invalidate("warehouse:list"));
	}
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});

	$: ({ warehouses: warehousesP, plugins, dbCtx: dbCtxP } = data);
	$: combined = Promise.all([dbCtxP, warehousesP]);

	let dbCtx: import("$lib/db/cr-sqlite").DbCtx | null = null;
	let db: import("$lib/db/cr-sqlite/types").DBAsync | undefined;
	// db is updated via side-effect in AsyncData

	let warehouses: import("$lib/db/cr-sqlite/types").Warehouse[] = [];

	$: ({ warehouseTotals } = stockCache);

	$: t = $LL.history_page.warehouse_tab;
</script>

<HistoryPage view="history/warehouse" {db} {plugins}>
	<svelte:fragment slot="main">
		<AsyncData data={combined} let:resolved>
			{@const [dbCtx, warehouses] = resolved}
			{((db = dbCtx.db), "")}
			<SkeletonList slot="loading" items={5} />
			<div class="flex h-full w-full flex-col divide-y">
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
			</div>
		</AsyncData>
	</svelte:fragment>
</HistoryPage>
