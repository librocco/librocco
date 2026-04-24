<script lang="ts">
	import { ChevronDown, Bell } from "lucide-svelte";
	import { createCollapsible, melt } from "@melt-ui/svelte";

	import LL from "@librocco/shared/i18n-svelte";
	import { formatters as dateFormatters } from "@librocco/shared/i18n-formatters";
	import type { DeliveryByISBN } from "$lib/db/cr-sqlite/types";

	export let finalized = false;
	export let books: DeliveryByISBN[] = [];
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

	$: hasBooks = books.length > 0;
	$: t = $LL.reconcile_page.step2.customer_notification;
	$: label = finalized ? t.message_finalized() : t.message_pending();

	function getCopyLabel(count: number): string {
		return t.copy_label({ count });
	}

	function formatOrderDate(created: Date): string {
		const datePart = $dateFormatters.dateShort(created);
		const timePart = $dateFormatters.timeOnly(created);
		return `${datePart}, ${timePart}`;
	}
</script>

<div use:melt={$collapsibleRoot} class="rounded-lg border border-base-300 bg-base-100 text-base-content">
	<div use:melt={$trigger} class="cursor-pointer px-4 py-3 transition-all {interactive ? 'hover:bg-base-200/60' : ''}">
		<div class="flex items-center gap-6">
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<Bell class="text-foreground h-4 w-4 shrink-0" aria-hidden="true" />
				<p class="text-foreground text-sm">{label}</p>
			</div>
			{#if interactive}
				<button class="shrink-0 rounded p-1 transition-colors {interactive ? 'hover:bg-base-200/70' : ''}">
					<ChevronDown class={`text-foreground h-5 w-5 transition-transform ${$open ? "rotate-180" : ""}`} aria-hidden="true" />
				</button>
			{/if}
		</div>
	</div>

	<div use:melt={$content}>
		{#if hasBooks}
			<div class="space-y-4 px-4 pb-3">
				{#each books as book}
					<div>
						<div class="mb-1">
							<div class="text-foreground inline-flex items-center gap-1.5 rounded bg-base-200 px-2 py-0.5 text-xs font-medium">
								<span>{book.isbn}</span>
								<span class="text-base-content/50">·</span>
								<span>{book.title}</span>
								<span>{getCopyLabel(book.customers.length)}</span>
							</div>
						</div>
						<div>
							<div class="flex gap-4 px-2 pb-1.5 pt-1.5">
								<div class="flex-1">
									<span class="text-muted-foreground text-xs font-normal uppercase tracking-[0.3px]">{t.table.customer()}</span>
								</div>
								<div class="w-32">
									<span class="text-muted-foreground text-xs font-normal uppercase tracking-[0.3px]">{t.table.id()}</span>
								</div>
								<div class="w-44">
									<span class="text-muted-foreground text-xs font-normal uppercase tracking-[0.3px]">{t.table.order_date()}</span>
								</div>
							</div>
							{#each book.customers as customer, index}
								{@const isLastCustomer = index === book.customers.length - 1}
								<div class="flex items-center gap-4 px-2 py-1 {!isLastCustomer ? 'border-b border-base-300/70' : ''}">
									<div class="min-w-0 flex-1">
										<span class="text-foreground text-sm">{customer.customer_name}</span>
									</div>
									<div class="w-32">
										<span class="text-muted-foreground text-sm">{customer.customer_display_id}</span>
									</div>
									<div class="w-44">
										<span class="text-muted-foreground text-sm">{formatOrderDate(customer.created)}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
