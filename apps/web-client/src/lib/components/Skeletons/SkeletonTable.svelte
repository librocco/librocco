<script lang="ts">
	import SkeletonBase from "./SkeletonBase.svelte";

	export let rows: number = 10;
	export let columns: number = 5;
	export let hasActions: boolean = false;
</script>

<div class="w-full">
	<table class="stock-table">
		<thead>
			<tr>
				{#each Array(columns + (hasActions ? 1 : 0)) as _}
					<th>
						<SkeletonBase height="1.5rem" rounded="rounded-md" />
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each Array(rows) as _}
				<tr>
					{#each Array(columns + (hasActions ? 1 : 0)) as _}
						<td>
							<SkeletonBase height="1rem" rounded="rounded-md" />
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	/* Ensure we inherit stock-table styles or mimic them if not global */
	.stock-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0 0.5rem;
	}
	.stock-table th,
	.stock-table td {
		padding: 0.5rem;
	}
</style>
