<script lang="ts">
	import { onMount } from "svelte";

	import { firstValueFrom, map } from "rxjs";
	import { Loader2 as Loader, Library, Percent } from "lucide-svelte";

	import { entityListView, filter, testId } from "@librocco/shared";

	import HistoryPage from "$lib/components/HistoryPage.svelte";

	import { getDB } from "$lib/db";

	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";

	const { db } = getDB();

	const warehouseListCtx = { name: "[WAREHOUSE_LIST]", debug: false };
	const warehouseListStream = db
		?.stream()
		.warehouseMap(warehouseListCtx)
		/** @TODO we could probably wrap the Map to be ArrayLike (by having 'm.length' = 'm.size') */
		.pipe(map((m) => [...filter(m, ([warehouseId]) => !warehouseId.includes("all"))]));
	const warehouseList = readableFromStream(warehouseListCtx, warehouseListStream, []);

	let initialised = false;
	onMount(() => {
		firstValueFrom(warehouseListStream).then((wls) => {
			console.log("warehouseListStream", wls);
			initialised = true;
		});
	});
</script>

<HistoryPage view="history/warehouse" loaded={initialised}>
	<svelte:fragment slot="main">
		{#if !initialised}
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else}
			<!-- Start entity list contaier -->

			<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
			<ul class={testId("entity-list-container")} data-view={entityListView("warehouse-list")} data-loaded={true}>
				<!-- Start entity list -->
				{#each $warehouseList as [warehouseId, warehouse]}
					{@const displayName = warehouse.displayName || warehouseId}
					{@const totalBooks = warehouse.totalBooks}
					{@const href = appPath("history/warehouse", warehouseId)}
					{@const warehouseDiscount = warehouse.discountPercentage}

					<div class="group entity-list-row">
						<div class="flex flex-col gap-y-2 self-start">
							<a {href} class="entity-list-text-lg text-gray-900 hover:underline focus:underline">{displayName}</a>

							<div class="flex flex-col gap-2 sm:flex-row">
								<div class="flex w-32 items-center gap-x-1">
									<Library class="text-gray-700" size={20} />
									<span class="entity-list-text-sm text-gray-500">{totalBooks} books</span>
								</div>

								{#if warehouseDiscount}
									<div class="flex items-center gap-x-1">
										<div class="border border-gray-700 p-[1px]">
											<Percent class="text-gray-700" size={14} />
										</div>
										<span class="entity-list-text-sm text-gray-500">{warehouseDiscount}% discount</span>
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
	</svelte:fragment>
</HistoryPage>
