<script lang="ts">
	import { Building2, Hash, CalendarClock } from "lucide-svelte";
	import type { Writable } from "svelte/store";

	import { HeadCol, BodyMultiRow } from "../Cells";

	import BodyHead from "./BodyHead.svelte";
	import BodyLink from "./BodyLink.svelte";

	import type { OrderData } from "../types";

	export let data: Writable<OrderData[]>;
</script>

<table id="supplier-orders">
	<thead>
		<tr>
			<th scope="col">
				<HeadCol icon={Building2} label="Supplier" />
			</th>
			<th scope="col">
				<HeadCol icon={Hash} label="Order no." />
			</th>
			<th scope="col">
				<HeadCol icon={CalendarClock} label="Ordered" />
			</th>
			<th scope="col">
				<HeadCol label="Edit Row" srOnly />
			</th>
		</tr>
	</thead>
	<tbody>
		{#each $data as row (row.id)}
			{@const { name, id, lastUpdated, draft, actionLink } = row}
			<tr>
				<th scope="row" data-property="supplier">
					<BodyHead borderStyle={draft ? "gray" : "yellow"}>
						<BodyMultiRow
							rows={{
								name: { data: name, className: "text-lg font-normal" }
							}}
						/>
					</BodyHead>
				</th>
				<td data-property="id">{id}</td>
				<td data-property="last-updated">
					<span class="badge badge-md {draft ? 'badge-gray' : 'badge-yellow'}">
						{lastUpdated}
					</span>
				</td>
				<td data-property="action">
					<BodyLink link={actionLink} label={draft ? "Edit" : "Manage"} style={draft ? "gray" : "yellow"} />
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
