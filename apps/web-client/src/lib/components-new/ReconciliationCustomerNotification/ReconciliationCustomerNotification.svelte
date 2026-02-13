<script lang="ts">
	import { ChevronDown, Bell } from "lucide-svelte";
	import { createCollapsible, melt } from "@melt-ui/svelte";

	import LL from "@librocco/shared/i18n-svelte";

	import type { CustomerOrderLine } from "$lib/db/cr-sqlite/types";

	// TODO: the following are duplicates from routes/orders/suppliers/reconcile/[id]/utils.ts -- move into a standardised location
	type CustomerDeliveryEntry = Pick<CustomerOrderLine, "fullname" | "customer_display_id" | "created">;
	type DeliveryByISBN = { isbn: string; title: string; total: number; customers: CustomerDeliveryEntry[] };

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

	const hasBooks = books.length > 0;
	$: t = $LL.reconcile_page.step2.customer_notification;
	$: label = finalized ? t.message_finalized() : t.message_pending();

	function getCopyLabel(count: number): string {
		return t.copy_label({ count });
	}
</script>

<div use:melt={$collapsibleRoot} class="rounded-lg border border-neutral-200 bg-neutral-50">
	<div use:melt={$trigger} class="cursor-pointer px-4 py-3 transition-all {interactive ? 'hover:bg-neutral-100' : ''}">
		<div class="flex items-center gap-6">
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<Bell class="text-foreground h-4 w-4 shrink-0" aria-hidden="true" />
				<p class="text-foreground text-sm">{label}</p>
			</div>
			<button
				class="shrink-0 rounded p-1 transition-colors {interactive ? 'hover:bg-neutral-200' : ''}"
				on:click={(e) => e.stopPropagation()}
			>
				{#if interactive}
					<ChevronDown class={`text-foreground h-5 w-5 transition-transform ${$open ? "rotate-180" : ""}`} aria-hidden="true" />
				{/if}
			</button>
		</div>
	</div>

	<div use:melt={$content}>
		{#if hasBooks}
			<div class="space-y-4 px-4 pb-3">
				{#each books as book}
					<div>
						<div class="mb-1">
							<div class="text-foreground inline-flex items-center gap-1.5 rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium">
								<span>{book.isbn}</span>
								<span class="text-neutral-500">·</span>
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
								<div class="flex items-center gap-4 px-2 py-1 {!isLastCustomer ? 'border-b border-neutral-200' : ''}">
									<div class="min-w-0 flex-1">
										<span class="text-foreground text-sm">{customer.fullname}</span>
									</div>
									<div class="w-32">
										<span class="text-muted-foreground text-sm">{customer.customer_display_id}</span>
									</div>
									<div class="w-44">
										<span class="text-muted-foreground text-sm">{customer.created}</span>
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
