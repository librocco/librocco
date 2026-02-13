<script lang="ts">
	import { _group, _groupIntoMap } from "@librocco/shared";

	import type { PageData } from "./$types";

	import CounterBadge from "$lib/components-new/CounterBadge/CounterBadge.svelte";
	import ReconciliationOrderSummary from "$lib/components-new/ReconciliationOrderSummary/ReconciliationOrderSummary.svelte";
	import UnderdeliveryActionBadge from "$lib/components-new/ReconciliationOrderSummary/UnderdeliveryActionBadge.svelte";
	import ReconciliationCustomerNotification from "$lib/components-new/ReconciliationCustomerNotification/ReconciliationCustomerNotification.svelte";

	import { calcCustomerOrderDelivery, calcStatsBySupplierOrder } from "./utils";

	export let data: PageData;

	export let finalized = false;

	export let onBack: () => void;
	export let onFinalize: () => void;

	// TODO: update when underdelivery behaviour is in
	let disableFinalize = false;

	$: orderStats = calcStatsBySupplierOrder(data);
	$: customerDelivery = calcCustomerOrderDelivery(data);
	$: totalOrdered = data.placedOrderLines.reduce((sum, line) => sum + line.quantity, 0);
	$: totalDelivered = data.reconciliationOrderLines.reduce((sum, line) => sum + line.quantity, 0);
</script>

<div class="flex h-screen max-h-full flex-1 flex-col overflow-hidden">
	<div class="mt-6 mb-6 flex gap-3 px-6">
		<CounterBadge label="Total Ordered" value={totalOrdered} />
		<CounterBadge label="Total Delivered" value={totalDelivered} />
	</div>

	<div class="flex flex-1 flex-col overflow-y-auto bg-white px-6 pb-6">
		<div class="mb-4 space-y-4">
			{#each orderStats as { supplier_order_id, supplier_name, totalUnderdelivered, lines }}
				<ReconciliationOrderSummary
					orderId={`Order #${supplier_order_id}`}
					customerName={supplier_name}
					undeliveredCount={totalUnderdelivered}
					books={lines}
					interactive={!finalized}
					expanded={finalized}
				>
					<!-- NOTE: this is always shown (regardless of order being finalized or not, TODO: update when underdelivery behaviour logic is in) -->
					<UnderdeliveryActionBadge slot="underdelivery_behaviour" value="pending" />
				</ReconciliationOrderSummary>
			{/each}
		</div>

		{#if customerDelivery.length > 0}
			<div class="mt-4">
				<ReconciliationCustomerNotification
					message={finalized
						? "These customers were notified that delivered books are ready for collection"
						: "Customers will be notified that delivered books are ready for collection"}
					books={customerDelivery}
					interactive={!finalized}
					expanded={true}
				/>
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
					← Back
				</button>
				<button
					disabled={finalized || disableFinalize}
					class="rounded-md bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-900"
					on:click={onFinalize}
				>
					Finalize Delivery
				</button>
			</div>
		</div>
	{:else}
		<div class="flex shrink-0 items-center justify-between border-t border-neutral-200 bg-neutral-50 px-6 py-4">
			<div class="text-sm text-zinc-900">Delivery finalized on 12/02/2026</div>
		</div>
	{/if}
</div>
