<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { Loader2 as Loader, Library, Percent } from "lucide-svelte";
	import { invalidate } from "$app/navigation";

	import type { PageData } from "./$types";

	import { entityListView, testId } from "@librocco/shared";

	import HistoryPage from "$lib/components/HistoryPage.svelte";

	import { appPath } from "$lib/paths";
	import LL from "$i18n/i18n-svelte";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload when warehouse data changes
		const disposer1 = rx.onRange(["warehouse"], () => invalidate("warehouse:list"));
		// Reload when a note gets committed (affecting stock)
		const disposer2 = rx.onRange(["note"], () => invalidate("warehouse:books"));
		disposer = () => (disposer1(), disposer2());
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});

	$: warehouses = data.warehouses;

	let initialised = false;
	$: initialised = Boolean(data);
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
				{#each warehouses as warehouse}
					{@const displayName = warehouse.displayName || warehouse.id}
					{@const totalBooks = warehouse.totalBooks}
					{@const href = appPath("history/warehouse", warehouse.id)}
					{@const warehouseDiscount = warehouse.discount}

					<div class="group entity-list-row">
						<div class="flex flex-col gap-y-2 self-start">
							<a {href} class="entity-list-text-lg text-gray-900 hover:underline focus:underline">{displayName}</a>

							<div class="flex flex-col gap-2 sm:flex-row">
								<div class="flex w-32 items-center gap-x-1">
									<Library class="text-gray-700" size={20} />
									<span class="entity-list-text-sm text-gray-500">{totalBooks} {$LL.historyPage.warehouse.books()}</span>
								</div>

								{#if warehouseDiscount}
									<div class="flex items-center gap-x-1">
										<div class="border border-gray-700 p-[1px]">
											<Percent class="text-gray-700" size={14} />
										</div>
										<span class="entity-list-text-sm text-gray-500">{warehouseDiscount}% {$LL.historyPage.warehouse.discount()}</span>
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
