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

	export let isDraft = (x: SupplierOrderData) => !x.placedAt;
</script>

<table id="supplier-orders">
	<thead>
		<tr>
			<th scope="col">
				<HeadCol icon={Building2} label="Supplier" />
			</th>
			<th scope="col">
				<HeadCol label="Total Books" />
			</th>
			<th scope="col">
				<HeadCol icon={CalendarClock} label="Ordered" />
			</th>
			<th scope="col">
				<HeadCol icon={Hash} label="Order no." />
			</th>
		</tr>
	</thead>
	<tbody>
		{#each $data as row (row.id)}
			{@const { supplierName, id, placedAt, totalBooks, actionLink } = row}
			{@const draft = isDraft(row)}
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
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
