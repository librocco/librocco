<script lang="ts">
	import LL from "@librocco/shared/i18n-svelte";

	import type { PageData } from "./$types";
	import type { ReconciliationBreakdown } from "./utils";

	import CounterBadge from "$lib/components-new/CounterBadge/CounterBadge.svelte";
	import ReconciliationOrderSummary from "$lib/components-new/ReconciliationOrderSummary/ReconciliationOrderSummary.svelte";
	import UnderdeliveryActionBadge from "$lib/components-new/ReconciliationOrderSummary/UnderdeliveryActionBadge.svelte";
	import ReconciliationCustomerNotification from "$lib/components-new/ReconciliationCustomerNotification/ReconciliationCustomerNotification.svelte";

	import {
		calcAcceptedDeliveredTotal,
		calcCustomerOrderDelivery,
		calcOverdeliveryLines,
		calcOverdeliveredTotal,
		calcStatsBySupplierOrder
	} from "./utils";

	export let data: PageData;
	export let reconciliationBreakdown: ReconciliationBreakdown;

	export let finalized = false;

	export let onBack: () => void;
	export let onFinalize: () => void;

	// TODO: update when underdelivery behaviour is in
	let disableFinalize = false;

	$: orderStats = calcStatsBySupplierOrder(data, reconciliationBreakdown);
	$: customerDelivery = calcCustomerOrderDelivery(data, reconciliationBreakdown);
	$: overdeliveryLines = calcOverdeliveryLines(data, reconciliationBreakdown);
	$: totalOrdered = data.placedOrderLines.reduce((sum, line) => sum + line.quantity, 0);
	$: totalDelivered = calcAcceptedDeliveredTotal(data, reconciliationBreakdown);
	$: totalOverdelivered = calcOverdeliveredTotal(data, reconciliationBreakdown);

	$: t = $LL.reconcile_page.step2;
</script>

<div class="flex h-screen max-h-full flex-1 flex-col overflow-hidden">
	<div class="mt-6 mb-6 flex gap-3 px-6">
		<CounterBadge label={t.stats.total_ordered()} value={totalOrdered} />
		<CounterBadge label={t.stats.total_delivered()} value={totalDelivered} />
		{#if totalOverdelivered > 0}
			<CounterBadge label={t.stats.overdelivered()} value={totalOverdelivered} />
		{/if}
	</div>

	<div class="flex flex-1 flex-col overflow-y-auto bg-white px-6 pb-6">
		{#if overdeliveryLines.length > 0}
			<div class="mb-4 overflow-hidden rounded-lg border border-orange-200 bg-orange-50/30">
				<details class="group" open={!finalized}>
					<summary class="cursor-pointer list-none px-4 py-3">
						<div class="flex items-center justify-between gap-2">
							<div class="text-sm font-medium text-orange-900">{t.overdelivery.title({ count: totalOverdelivered })}</div>
							<div class="text-xs text-orange-700 group-open:hidden">{t.overdelivery.show_details()}</div>
							<div class="hidden text-xs text-orange-700 group-open:block">{t.overdelivery.hide_details()}</div>
						</div>
					</summary>
					<div class="space-y-1 border-t border-orange-200 px-4 py-3">
						{#each overdeliveryLines as line (line.isbn)}
							<div class="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm">
								<div class="min-w-0 truncate text-zinc-900">{line.isbn} · {line.title}</div>
								<div class="shrink-0 font-semibold text-orange-700">+{line.overdeliveredQuantity}</div>
							</div>
						{/each}
					</div>
				</details>
			</div>
		{/if}

		<div class="my-4 space-y-4">
			{#each orderStats as { supplier_order_id, supplier_name, underdelivery_policy, totalUnderdelivered, lines }}
				{@const underdeliveryAction = underdelivery_policy === 0 ? "keep_open" : "reorder"}
				<ReconciliationOrderSummary
					orderId={t.order_summary.order_id({ id: supplier_order_id })}
					customerName={supplier_name}
					undeliveredCount={totalUnderdelivered}
					books={lines}
					interactive={!finalized}
					expanded={finalized}
				>
					<UnderdeliveryActionBadge slot="underdelivery_behaviour" value={underdeliveryAction} />
				</ReconciliationOrderSummary>
			{/each}
		</div>

		{#if customerDelivery.length > 0}
			<div class="mt-4">
				<ReconciliationCustomerNotification {finalized} books={customerDelivery} interactive={!finalized} expanded={true} />
			</div>
		{/if}
	</div>

	{#if !finalized}
		<div class="shrink-0 border-t border-neutral-200 bg-neutral-50">
			<div class="flex items-center justify-between px-6 py-4">
				<button
					on:click={onBack}
					class="rounded-md border border-neutral-200 bg-white px-6 py-2 text-zinc-900 transition-colors hover:bg-neutral-50"
				>
					{t.actions.back()}
				</button>
				<button
					disabled={finalized || disableFinalize}
					class="rounded-md bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-900"
					on:click={onFinalize}
				>
					{t.actions.finalize()}
				</button>
			</div>
		</div>
	{:else}
		<div class="flex shrink-0 items-center justify-between border-t border-neutral-200 bg-neutral-50 px-6 py-4">
			<div class="text-sm text-zinc-900">{t.finalized.message({ date: new Date(data?.reconciliationOrder.updatedAt) })}</div>
		</div>
	{/if}
</div>
