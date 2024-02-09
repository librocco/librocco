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
	<tbody class="gap-y-4 divide-y">
		{#each $data as row (row.id)}
			{@const { name, id, lastUpdated, actionLink } = row}
			<tr>
				<th scope="row">
					<BodyHead borderStyle="yellow">
						<BodyMultiRow
							rows={{
								name: { data: name, className: "text-md font-medium" }
							}}
						/>
					</BodyHead>
				</th>
				<td>{id}</td>
				<td>
					<span class="badge badge-md badge-yellow">
						{lastUpdated}
					</span>
				</td>
				<td>
					<BodyLink link={actionLink} label="Manage" style="yellow" />
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	@import "./table.css";
</style>
