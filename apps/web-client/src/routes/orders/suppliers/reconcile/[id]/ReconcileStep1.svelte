<script lang="ts">
	import DaisyUIScannerForm from "$lib/forms/DaisyUIScannerForm.svelte";
	import Table from "$lib/components-new/Table/Table.svelte";
	import TableRow from "$lib/components-new/Table/TableRow.svelte";
	import CounterBadge from "$lib/components-new/CounterBadge/CounterBadge.svelte";
	import ArrowRight from "$lucide/arrow-right";

	import LL from "@librocco/shared/i18n-svelte";

	import type { PageData } from "./$types";
	import { calcStatsBySupplierOrder } from "./utils";

	export let data: PageData;

	export let onScan: (isbn: string) => Promise<void> | void;
	export let onDecrement: (isbn: string) => Promise<void> | void;
	export let onIncrement: (isbn: string) => Promise<void> | void;
	export let onContinue: () => void;

	$: orderStats = calcStatsBySupplierOrder(data);
	$: totalOrdered = data.placedOrderLines.reduce((sum, line) => sum + line.quantity, 0);
	$: totalDelivered = data.reconciliationOrderLines.reduce((sum, line) => sum + line.quantity, 0);

	$: t = $LL.reconcile_page;

	function getDeliveredColorClass(ordered: number, delivered: number): string {
		if (delivered === 0) {
			return "text-foreground";
		} else if (delivered < ordered) {
			return "text-warning";
		} else if (delivered === ordered) {
			return "text-success";
		} else {
			return "text-destructive";
		}
	}
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<div class="shrink-0 border-b border-neutral-200 bg-white">
		<div class="px-6 py-4">
			<div class="space-y-4">
				<DaisyUIScannerForm onSubmit={onScan} />
			</div>
		</div>
	</div>

	<div class="flex h-full flex-col space-y-4 overflow-hidden bg-white px-6 py-4">
		<div class="flex gap-3">
			<CounterBadge label={t.step1.stats.total_ordered()} value={totalOrdered} />
			<CounterBadge label={t.step1.stats.total_delivered()} value={totalDelivered} />
		</div>

		<div class="h-full overflow-y-auto">
			{#each orderStats as supplierOrder (supplierOrder.supplier_order_id)}
				<div class="mb-4">
					<div class="-mb-6">
						<span class="text-foreground rounded-md bg-[#f8f8f8] px-2 py-0.5 text-xs font-medium">
							{supplierOrder.supplier_name} # {supplierOrder.supplier_order_id}
						</span>
					</div>
					<Table variant="naked" columnWidths={["2", "3", "4", "2", "2", "2"]}>
						<svelte:fragment slot="head-cells">
							<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide">{t.table.isbn()}</th>
							<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide">{t.table.title()}</th>
							<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide">{t.table.authors()}</th>
							<th scope="col" class="text-muted-foreground w-20 px-2 py-1.5 text-left text-xs uppercase tracking-wide"
								>{t.table.quantity()}</th
							>
							<th scope="col" class="text-muted-foreground w-32 px-2 py-1.5 text-left text-xs uppercase tracking-wide"
								>{t.step1.table.delivered()}</th
							>
							<th scope="col" class="text-muted-foreground w-32 px-2 py-1.5 text-left text-xs uppercase tracking-wide">
								<span class="sr-only">{t.step1.table.controls()}</span>
							</th>
						</svelte:fragment>

						<svelte:fragment slot="rows">
							{#each supplierOrder.lines as book, ix (book.isbn)}
								{@const stats = { ordered: book.orderedQuantity, delivered: book.deliveredQuantity }}
								{@const isLastBook = ix === supplierOrder.lines.length + 1}
								{@const deliveredColor = getDeliveredColorClass(stats.ordered, stats.delivered)}
								<TableRow
									variant="naked"
									className="hover:bg-neutral-50 transition-all duration-[120ms] {isLastBook ? '' : 'border-b border-neutral-100'}"
								>
									<td class="text-foreground w-32 min-w-0 shrink-0 px-2 py-1.5 align-middle text-sm font-medium">
										{book.isbn}
									</td>
									<td class="text-foreground w-32 min-w-0 truncate px-2 py-1.5 align-middle text-sm">
										{book.title}
									</td>
									<td class="text-foreground min-w-0 flex-1 truncate px-2 py-1.5 align-middle text-sm">
										{book.authors}
									</td>
									<td class="text-foreground w-20 px-2 py-1.5 text-start align-middle text-sm font-medium">
										{stats.ordered}
									</td>
									<td class="flex items-center justify-between gap-2 px-2 py-1.5">
										<span class="text-sm font-semibold {deliveredColor}">
											{stats.delivered}
										</span>
										<div class="flex gap-1">
											<button
												on:click={() => onDecrement(book.isbn)}
												disabled={stats.delivered === 0}
												class="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
												aria-label={t.step1.aria_labels.decrease_quantity({ title: book.title, count: stats.delivered })}
											>
												−
											</button>
											<button
												on:click={() => onIncrement(book.isbn)}
												class="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 transition-colors hover:bg-neutral-200"
												aria-label={t.step1.aria_labels.increase_quantity({ title: book.title, count: stats.delivered })}
											>
												+
											</button>
										</div>
									</td>
								</TableRow>
							{/each}
						</svelte:fragment>
					</Table>
				</div>
			{/each}
		</div>
	</div>

	{#if totalDelivered > 0}
		<div class="shrink-0 border-t border-neutral-200 bg-neutral-50 px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="text-sm text-zinc-900">
					{t.step1.footer.total_scanned({ count: totalDelivered })}
				</div>
				<button
					on:click={onContinue}
					class="flex items-center gap-2 rounded-md bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800"
				>
					{t.step1.footer.continue()}
					<ArrowRight aria-hidden />
				</button>
			</div>
		</div>
	{/if}
</div>
