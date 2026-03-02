<script lang="ts">
	import { formatters as dateFormatters } from "@librocco/shared/i18n-formatters";
	import LL from "@librocco/shared/i18n-svelte";

	import type { App } from "$lib/app";
	import type { PlacedSupplierOrder } from "$lib/db/cr-sqlite/types";
	import type { SupplierOrdersViewData } from "./dataLoad";

	import { Table } from "$lib/components-new/Table";

	import { goto as _goto } from "$lib/utils/navigation";

	import { getDb, getDbRx } from "$lib/app/db";
	import { createOrdersViewStore } from "./dataLoad";

	import { appPath } from "$lib/paths";

	type Props = {
		app: App;
		supplierId: number;
		pageData?: SupplierOrdersViewData | null;
	};

	let { app, supplierId, pageData }: Props = $props();

	const rx = getDbRx(app);
	const dataStore = createOrdersViewStore(rx, () => getDb(app), supplierId, pageData ?? undefined);

	const placedOrders = $derived((dataStore.data.placedOrders ?? []) as PlacedSupplierOrder[]);
	const reconcilingOrders = $derived((dataStore.data.reconcilingOrders ?? []) as PlacedSupplierOrder[]);
	const completedOrders = $derived((dataStore.data.completedOrders ?? []) as PlacedSupplierOrder[]);
	const orderedTableT = $derived($LL.supplier_orders_component.ordered_table);
	const reconcilingTableT = $derived($LL.supplier_orders_component.reconciling_table);
	const completedTableT = $derived($LL.supplier_orders_component.completed_table);
	const tabsT = $derived($LL.supplier_orders_page.tabs);
	const dateTimeFormatter = $derived($dateFormatters.dateTime);

	function formatCreated(timestamp: number): string {
		return dateTimeFormatter(new Date(timestamp));
	}
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
						onclick={() => _goto(appPath("supplier_orders", id))}
						onkeydown={(e) => e.key === "Enter" && _goto(appPath("supplier_orders", id))}
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
						onclick={() => _goto(appPath("supplier_orders", id))}
						onkeydown={(e) => e.key === "Enter" && _goto(appPath("supplier_orders", id))}
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
						onclick={() => _goto(appPath("supplier_orders", id))}
						onkeydown={(e) => e.key === "Enter" && _goto(appPath("supplier_orders", id))}
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
