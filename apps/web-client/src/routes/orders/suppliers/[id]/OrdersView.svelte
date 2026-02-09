<script lang="ts">
	import type { PageData } from "./$types";

	import { Table } from "$lib/components-new/Table";
	import { formatters as dateFormatters } from "@librocco/shared/i18n-formatters";
	import LL from "@librocco/shared/i18n-svelte";

	import { goto as _goto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";

	export let data: PageData;

	$: ({ placedOrders, reconcilingOrders, completedOrders } = data);

	function formatCreated(timestamp: number): string {
		return $dateFormatters.dateTime(new Date(timestamp));
	}

	$: orderedTableT = $LL.supplier_orders_component.ordered_table;
	$: reconcilingTableT = $LL.supplier_orders_component.reconciling_table;
	$: completedTableT = $LL.supplier_orders_component.completed_table;
	$: tabsT = $LL.supplier_orders_page.tabs;
</script>

<div class="px-5">
	<div class="mb-8">
		<h4 class="mb-4 text-[14px]">{tabsT.ordered()}</h4>
		<Table columnWidths={["3", "3", "6"]} showEmptyState={placedOrders.length === 0}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.order_id()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.supplier()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.placed()}</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each placedOrders as { supplier_name, created, id }}
					<tr
						tabindex="0"
						role="button"
						class="cursor-pointer border-b border-[#E5E5E5] px-[16px] py-[8px] transition-colors last:border-b-0 hover:cursor-pointer hover:bg-[#FAFAFA]"
						on:click={() => _goto(appPath("supplier_orders", id))}
						on:keydown={(e) => e.key === "Enter" && _goto(appPath("supplier_orders", id))}
					>
						<td class="px-4 py-2 text-sm">#{id}</td>
						<td class="px-4 py-2 text-sm">{supplier_name}</td>
						<td class="px-4 py-2 text-sm">{formatCreated(created)}</td>
					</tr>
				{/each}
			</svelte:fragment>

			<svelte:fragment slot="empty">{orderedTableT.empty()}</svelte:fragment>
		</Table>
	</div>

	<div class="mb-8">
		<h4 class="mb-4 text-[14px]">{tabsT.reconciling()}</h4>
		<Table columnWidths={["3", "3", "6"]} showEmptyState={reconcilingOrders.length === 0}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.order_id()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.supplier()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.placed()}</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each reconcilingOrders as { supplier_name, created, id }}
					<tr
						tabindex="0"
						role="button"
						class="cursor-pointer border-b border-[#E5E5E5] px-[16px] py-[8px] transition-colors last:border-b-0 hover:cursor-pointer hover:bg-[#FAFAFA]"
						on:click={() => _goto(appPath("supplier_orders", id))}
						on:keydown={(e) => e.key === "Enter" && _goto(appPath("supplier_orders", id))}
					>
						<td class="px-4 py-2 text-sm">#{id}</td>
						<td class="px-4 py-2 text-sm">{supplier_name}</td>
						<td class="px-4 py-2 text-sm">{formatCreated(created)}</td>
					</tr>
				{/each}
			</svelte:fragment>

			<svelte:fragment slot="empty">{reconcilingTableT.empty()}</svelte:fragment>
		</Table>
	</div>

	<!-- NOTE: this implementation assumes the number of finalized orders won't bloat the view, in practice this is likely the case -->
	<!-- TODO: add infinite scroll or some other way of handling this -->
	<div class="mb-8">
		<h4 class="mb-4 text-[14px]">{tabsT.completed()}</h4>
		<Table columnWidths={["3", "3", "6"]} showEmptyState={completedOrders.length === 0}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.order_id()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.supplier()}</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">{orderedTableT.placed()}</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each completedOrders as { supplier_name, created, id }}
					<tr
						tabindex="0"
						role="button"
						class="cursor-pointer border-b border-[#E5E5E5] px-[16px] py-[8px] transition-colors last:border-b-0 hover:cursor-pointer hover:bg-[#FAFAFA]"
						on:click={() => _goto(appPath("supplier_orders", id))}
						on:keydown={(e) => e.key === "Enter" && _goto(appPath("supplier_orders", id))}
					>
						<td class="px-4 py-2 text-sm">#{id}</td>
						<td class="px-4 py-2 text-sm">{supplier_name}</td>
						<td class="px-4 py-2 text-sm">{formatCreated(created)}</td>
					</tr>
				{/each}
			</svelte:fragment>

			<svelte:fragment slot="empty">{completedTableT.empty()}</svelte:fragment>
		</Table>
	</div>
</div>
