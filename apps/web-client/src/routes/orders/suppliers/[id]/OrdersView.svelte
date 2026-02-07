<script lang="ts">
	import { createEventDispatcher } from "svelte";

	import type { PageData } from "./$types";

	import { Table, TableRow } from "$lib/components-new/Table";
	import { formatters as dateFormatters } from "@librocco/shared/i18n-formatters";
	import LL from "@librocco/shared/i18n-svelte";

	import { goto as _goto } from "$lib/utils/navigation";

	export let data: PageData;

	$: ({ placedOrders, reconcilingOrders, completedOrders } = data);

	let selectedOrders: Array<number>;
	$: selectedOrders = [];
	$: hasSelectedOrders = selectedOrders.length > 0;

	function toggleOrderSelection(supplierOrderId: number) {
		if (selectedOrders.includes(supplierOrderId)) {
			selectedOrders = selectedOrders.filter((id) => id !== supplierOrderId);
		} else {
			selectedOrders = [...selectedOrders, supplierOrderId];
		}
	}

	const dispatch = createEventDispatcher<{ reconcile: { supplierOrderIds: number[] }; download: { supplierOrderId: number } }>();

	async function handleReconcile(supplierOrderIds: number[]) {
		const validOrderIds = supplierOrderIds.filter((id) => placedOrders.some((order) => order.id === id));

		if (validOrderIds.length === 0) {
			console.warn("No valid orders selected for reconciliation");
			return;
		}

		dispatch("reconcile", { supplierOrderIds: validOrderIds });
	}

	function formatCreated(timestamp: number): string {
		return $dateFormatters.dateTime(new Date(timestamp));
	}

	$: orderedTableT = $LL.supplier_orders_component.ordered_table;
	$: reconcilingTableT = $LL.supplier_orders_component.reconciling_table;
	$: completedTableT = $LL.supplier_orders_component.completed_table;
	$: tabsT = $LL.supplier_orders_page.tabs;
</script>

<div class="px-5">
	{#if hasSelectedOrders}
		<div class="absolute right-0 top-0 z-10 w-fit justify-end sm:right-3">
			<button class="btn-primary btn-sm btn flex-nowrap gap-x-2" on:click={() => handleReconcile(selectedOrders)}>
				{orderedTableT.reconcile_selected({ count: selectedOrders.length })}
			</button>
		</div>
	{/if}

	<div class="mb-8">
		<h4 class="mb-4 text-[14px]">{tabsT.ordered()}</h4>
		<Table columnWidths={["1", "2", "3", "6"]} showEmptyState={placedOrders.length === 0}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="min-w-6 w-auto px-4 py-3 text-left align-middle text-xs"
					><span class="sr-only">{orderedTableT.select()}</span></th
				>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.order_id()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.supplier()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.placed()}</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each placedOrders as { supplier_name, created, id }}
					<TableRow selected={selectedOrders.includes(id)}>
						<td class="min-w-6 px-4 py-2 text-left align-middle">
							<input
								type="checkbox"
								checked={selectedOrders.includes(id)}
								on:change={() => toggleOrderSelection(id)}
								class="h-4 w-4 accent-[#422AD5]"
							/>
						</td>
						<td class="px-4 py-2 text-sm">#{id}</td>
						<td class="px-4 py-2 text-sm">{supplier_name}</td>
						<td class="px-4 py-2 text-sm">{formatCreated(created)}</td>
					</TableRow>
				{/each}
			</svelte:fragment>

			<svelte:fragment slot="empty">{orderedTableT.empty()}</svelte:fragment>
		</Table>
	</div>

	<div class="mb-8">
		<h4 class="mb-4 text-[14px]">{tabsT.reconciling()}</h4>
		<Table columnWidths={["1", "2", "3", "6"]} showEmptyState={reconcilingOrders.length === 0}>
			<svelte:fragment slot="head-cells">
				<!-- NOTE: aria-hidden is used here to maintain column alignment with the Ordered section while
					hiding this non-interactive column from assistive technologies. This is not an ideal a11y
					solution - ideally we'd use a different column structure for non-selectable tables,
					but that would require additional logic to maintain visual alignment. -->
				<th scope="col" class="min-w-6 w-auto px-4 py-3 text-left align-middle text-xs" aria-hidden="true"></th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.order_id()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.supplier()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.placed()}</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each reconcilingOrders as { supplier_name, created, id }}
					<TableRow>
						<td class="min-w-6 px-4 py-2 text-left align-middle" aria-hidden="true"></td>
						<td class="px-4 py-2 text-sm">#{id}</td>
						<td class="px-4 py-2 text-sm">{supplier_name}</td>
						<td class="px-4 py-2 text-sm">{formatCreated(created)}</td>
					</TableRow>
				{/each}
			</svelte:fragment>

			<svelte:fragment slot="empty">{reconcilingTableT.empty()}</svelte:fragment>
		</Table>
	</div>

	<!-- NOTE: this implementation assumes the number of finalized orders won't bloat the view, in practice this is likely the case -->
	<!-- TODO: add infinite scroll or some other way of handling this -->
	<div class="mb-8">
		<h4 class="mb-4 text-[14px]">{tabsT.completed()}</h4>
		<Table columnWidths={["1", "2", "3", "6"]} showEmptyState={completedOrders.length === 0}>
			<svelte:fragment slot="head-cells">
				<!-- NOTE: aria-hidden is used here to maintain column alignment with the Ordered section while
					hiding this non-interactive column from assistive technologies. This is not an ideal a11y
					solution - ideally we'd use a different column structure for non-selectable tables,
					but that would require additional logic to maintain visual alignment. -->
				<th scope="col" class="min-w-6 w-auto px-4 py-3 text-left align-middle text-xs" aria-hidden="true"></th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.order_id()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.supplier()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.placed()}</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each completedOrders as { supplier_name, created, id }}
					<TableRow>
						<td class="min-w-6 px-4 py-2 text-left align-middle" aria-hidden="true"></td>
						<td class="px-4 py-2 text-sm">#{id}</td>
						<td class="px-4 py-2 text-sm">{supplier_name}</td>
						<td class="px-4 py-2 text-sm">{formatCreated(created)}</td>
					</TableRow>
				{/each}
			</svelte:fragment>

			<svelte:fragment slot="empty">{completedTableT.empty()}</svelte:fragment>
		</Table>
	</div>
</div>
