<script lang="ts">
	import { UserRound, Hash, CalendarClock } from "lucide-svelte";
	import type { Writable, Readable } from "svelte/store";

	import { HeadCol, BodyMultiRow } from "../Cells";

	import BodyHead from "./BodyHead.svelte";
	import BodyLink from "./BodyLink.svelte";

	import type { createTable } from "$lib/actions";
	import type { Customer } from "$lib/db/orders/types";

	export let table: ReturnType<typeof createTable<Customer>>;
	$: ({ rows } = $table);
</script>

<table id="customer-orders" class="order-table">
	<thead>
		<tr>
			<th scope="col">
				<HeadCol icon={UserRound} label="Customer" />
			</th>
			<th scope="col">
				<HeadCol icon={Hash} label="Order no." />
			</th>
			<th scope="col">
				<HeadCol icon={CalendarClock} label="Last updated" />
			</th>

			{#if $$slots["row-actions"]}
				<th scope="col" class="table-cell-fit"> <HeadCol label="Row Actions" srOnly /> </th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			{@const { fullname, email, id, rowIx, deposit } = row}

			<tr>
				<th scope="row" data-property="customer">
					<BodyHead borderStyle={"gray"}>
						<BodyMultiRow
							rows={{
								fullname: { data: fullname ?? "", className: "text-md font-medium" },
								email: { data: email ?? "", className: "text-md font-light" },
								deposit: { data: `${deposit ?? 0}`, className: "text-md font-light" }
							}}
						/>
					</BodyHead>
				</th>
				<td data-property="id">{id}</td>
				<td data-property="last-updated">
					<span class="badge badge-md {'badge-gray'}">
						{"lastUpdated"}
					</span>
				</td>

				{#if $$slots["row-actions"]}
					<td class="table-cell-fit">
						<slot name="row-actions" {row} {rowIx} />
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
