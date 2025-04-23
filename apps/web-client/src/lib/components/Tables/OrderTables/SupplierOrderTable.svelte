<script lang="ts" context="module">
	export type SupplierOrderData = {
		id: number;
		supplierId: number;
		supplierName: string;
		totalBooks: number;
		placedAt: string;
		// TODO: This isn't necessary atm
		// finalizedAt: string;

		actionLink: string;
	};
</script>

<script lang="ts">
	import { Building2, Hash, CalendarClock } from "lucide-svelte";
	import type { Writable } from "svelte/store";

	import { HeadCol, BodyMultiRow } from "../Cells";

	import BodyHead from "./BodyHead.svelte";
	import BodyLink from "./BodyLink.svelte";

	export let data: Writable<SupplierOrderData[]>;

	export let isPending = (x: SupplierOrderData) => !x.placedAt;

	import LL from "@librocco/shared/i18n-svelte";
</script>

<table id="supplier-orders" class="order-table">
	<thead>
		<tr>
			<th scope="col">
				<HeadCol icon={Building2} label={$LL.table_components.order_tables.supplier_order_table.supplier()} />
			</th>
			<th scope="col">
				<HeadCol label={$LL.table_components.order_tables.supplier_order_table.total_books()} />
			</th>
			<th scope="col">
				<HeadCol icon={CalendarClock} label={$LL.table_components.order_tables.supplier_order_table.ordered()} />
			</th>
			<th scope="col">
				<HeadCol icon={Hash} label={$LL.table_components.order_tables.supplier_order_table.order_no()} />
			</th>
		</tr>
	</thead>
	<tbody>
		{#each $data as row (row.id)}
			{@const { supplierName, id, placedAt, totalBooks, actionLink } = row}
			{@const pending = isPending(row)}
			<tr>
				<th scope="row" data-property="supplier">
					<BodyHead borderStyle={placedAt ? "yellow" : "gray"}>
						<BodyMultiRow
							rows={{
								name: { data: supplierName, className: "text-lg font-normal" }
							}}
						/>
					</BodyHead>
				</th>
				<td data-property="total-books">{totalBooks}</td>
				<td data-property="placed-at">
					<span class="badge badge-md {placedAt ? 'badge-yellow' : 'badge-gray'}">
						{placedAt}
					</span>
				</td>
				<td data-property="id">{id}</td>
				<td data-property="action">
					<BodyLink
						link={actionLink}
						label={pending
							? $LL.table_components.order_tables.supplier_order_table.edit()
							: $LL.table_components.order_tables.supplier_order_table.manage()}
						style={pending ? "gray" : "yellow"}
					/>
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
