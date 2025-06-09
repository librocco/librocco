<script lang="ts">
	import { Building2, Hash, CalendarClock } from "lucide-svelte";
	import type { Writable } from "svelte/store";

	import type { SupplierExtended } from "$lib/db/cr-sqlite/types";

	import { HeadCol, BodyMultiRow } from "../Cells";

	import BodyHead from "./BodyHead.svelte";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: Writable<SupplierExtended[]>;
</script>

<table id="supplier-orders" class="order-table">
	<thead>
		<tr>
			<th scope="col">
				<HeadCol icon={Building2} label={$LL.table_components.order_tables.supplier_table.labels.name()} />
			</th>

			<th scope="col">
				<HeadCol label={$LL.table_components.order_tables.supplier_table.labels.email()} />
			</th>

			<th scope="col">
				<HeadCol label={$LL.table_components.order_tables.supplier_table.labels.address()} />
			</th>

			<th scope="col">
				<HeadCol label={$LL.table_components.order_tables.supplier_table.labels.assigned_publishers()} />
			</th>

			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit">
					<HeadCol label={$LL.table_components.order_tables.supplier_table.labels.row_actions()} srOnly />
				</th>
			{/if}
		</tr>
	</thead>

	<tbody>
		{#each $data as row (row.id)}
			{@const { name, email, address, numPublishers } = row}
			<tr>
				<th scope="row" data-property="supplier">
					<BodyHead borderStyle="gray">
						<BodyMultiRow rows={{ name: { data: name, className: "text-lg font-normal" } }} />
					</BodyHead>
				</th>

				<td data-property="email">{email}</td>

				<td data-property="address">{address}</td>

				<td class="text-end" data-property="assigned-publishers">{numPublishers}</td>

				{#if $$slots["row-actions"]}
					<td class="table-cell-fit">
						<slot name="row-actions" {row} />
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
