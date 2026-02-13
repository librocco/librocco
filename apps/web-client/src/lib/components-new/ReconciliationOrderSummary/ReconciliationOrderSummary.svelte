<script lang="ts">
	import { ChevronDown } from "lucide-svelte";
	import { createCollapsible, melt } from "@melt-ui/svelte";

	import LL from "@librocco/shared/i18n-svelte";

	import type { ReconciliationProcessedLine } from "$lib/components/supplier-orders/utils";

	import Table from "$lib/components-new/Table/Table.svelte";
	import TableRow from "$lib/components-new/Table/TableRow.svelte";

	export let orderId = "";
	export let customerName = "";
	export let undeliveredCount = 0;
	export let books: ReconciliationProcessedLine[] = [];
	export let expanded = false;

	export let interactive = true;

	const {
		elements: { root: collapsibleRoot, trigger, content },
		states: { open }
	} = createCollapsible({
		defaultOpen: expanded,
		disabled: !interactive
	});

	$: if ($open !== expanded) {
		expanded = $open;
	}

	const allDelivered = books.every((book) => book.orderedQuantity === book.orderedQuantity) && books.length > 0;
	const hasBooks = books.length > 0;

	$: t = $LL.reconcile_page;
</script>

<div use:melt={$collapsibleRoot} class="rounded-lg border border-neutral-200">
	<div use:melt={$trigger} class="bg-card cursor-pointer px-4 py-3 transition-all {interactive ? 'hover:bg-neutral-100' : ''}">
		<div class="flex items-center justify-between gap-4">
			<div class="flex min-w-0 flex-1 items-start gap-3">
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<span class="font-medium text-zinc-900">{customerName}</span>
						<span class="text-muted-foreground text-sm">{orderId}</span>
						{#if !allDelivered && hasBooks}
							<span class="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
								{t.step2.order_summary.books_undelivered({ count: undeliveredCount })}
							</span>
						{:else if allDelivered && hasBooks}
							<span class="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">{t.step2.order_summary.complete()}</span>
						{/if}
					</div>
				</div>
				<button class="rounded p-1 transition-colors {interactive ? 'hover:bg-neutral-200' : ''}" on:click={(e) => e.stopPropagation()}>
					{#if interactive}
						<ChevronDown
							class={`lucide lucide-chevron-down h-5 w-5 text-zinc-900 transition-transform ${$open ? "rotate-180" : ""}`}
							aria-hidden="true"
						/>
					{/if}
				</button>
			</div>
		</div>
	</div>

	<div use:melt={$content}>
		{#if hasBooks}
			<div class="px-2 py-2">
				<Table variant="naked" columnWidths={["2", "3", "4", "2", "2", "2"]}>
					<svelte:fragment slot="head-cells">
						<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide">{t.table.isbn()}</th>
						<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide">{t.table.title()}</th>
						<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide">{t.table.authors()}</th>
						<th scope="col" class="text-muted-foreground w-20 px-2 py-1.5 text-left text-xs uppercase tracking-wide"
							>{t.table.quantity()}</th
						>
						<th scope="col" class="text-muted-foreground w-20 px-2 py-1.5 text-left text-xs uppercase tracking-wide"
							>{t.table.quantity()}</th
						>
						<th scope="col" class="text-muted-foreground w-20 px-2 py-1.5 text-left text-xs uppercase tracking-wide"
							>{t.step2.order_summary.status()}</th
						>
					</svelte:fragment>

					<svelte:fragment slot="rows">
						{#each books as book (book.isbn)}
							{@const isLastBook = book === books[books.length - 1]}
							{@const missingQuantity = book.orderedQuantity - book.deliveredQuantity}
							<TableRow variant="naked" className="transition-all duration-100 {isLastBook ? '' : 'border-b border-neutral-100'}">
								<td class="text-foreground line-clamp-1 w-32 min-w-0 shrink-0 px-2 py-1.5 align-middle text-sm font-medium">
									{book.isbn}
								</td>
								<td class="text-foreground w-32 min-w-0 truncate px-2 py-1.5 align-middle text-sm">
									{book.title}
								</td>
								<td class="text-foreground min-w-0 flex-1 truncate px-2 py-1.5 align-middle text-sm">
									{book.authors}
								</td>
								<td class="text-foreground w-20 px-2 py-1.5 text-start align-middle text-sm">
									{book.orderedQuantity}
								</td>
								<td class="text-foreground w-20 px-2 py-1.5 text-start align-middle text-sm font-medium">
									{book.deliveredQuantity}
								</td>
								<td class="flex w-20 justify-start px-2 py-1.5 align-middle">
									{#if missingQuantity > 0}
										<span class="whitespace-nowrap rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
											{t.step2.order_summary.missing({ count: missingQuantity })}
										</span>
									{:else}
										<span class="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">{t.step2.order_summary.complete()}</span
										>
									{/if}
								</td>
							</TableRow>
						{/each}
					</svelte:fragment>
				</Table>
			</div>

			<slot name="underdelivery_behaviour" />
		{/if}
	</div>
</div>
