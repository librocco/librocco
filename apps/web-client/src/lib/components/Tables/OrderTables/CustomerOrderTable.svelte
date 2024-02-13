<script lang="ts">
	import { UserRound, Hash, CalendarClock } from "lucide-svelte";
	import type { Writable } from "svelte/store";

	import { HeadCol, BodyMultiRow } from "../Cells";

	import BodyHead from "./BodyHead.svelte";
	import BodyLink from "./BodyLink.svelte";

	import type { OrderData } from "../types";

	export let data: Writable<OrderData[]>;
</script>

<table id="customer-orders">
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
			<th scope="col">
				<HeadCol label="Edit Row" srOnly />
			</th>
		</tr>
	</thead>
	<tbody>
		{#each $data as row (row.id)}
			{@const { name, email, id, lastUpdated, draft, actionLink } = row}
			<tr>
				<th scope="row">
					<BodyHead borderStyle={draft ? "gray" : "yellow"}>
						<BodyMultiRow
							rows={{
								name: { data: name, className: "text-md font-medium" },
								email: { data: email, className: "text-md font-light" }
							}}
						/>
					</BodyHead>
				</th>
				<td>{id}</td>
				<td>
					<span class="badge badge-md {draft ? 'badge-gray' : 'badge-yellow'}">
						{lastUpdated}
					</span>
				</td>
				<td>
					<BodyLink link={actionLink} label={draft ? "Edit" : "Manage"} style={draft ? "gray" : "yellow"} />
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
