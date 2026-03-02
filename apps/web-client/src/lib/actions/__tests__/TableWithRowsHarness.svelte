<script lang="ts">
	import { type createTable } from "../table";

	export let table: ReturnType<typeof createTable<Record<string, unknown>>>;

	const { table: tableAction } = table;
	$: ({ rows } = $table);
	$: rowCount = rows.length + 1;
</script>

<table use:tableAction={{ rowCount }}>
	<tbody>
		{#each rows as row (row.key)}
			<tr use:table.tableRow={{ position: row.rowIx }}>
				<td>{row.isbn}</td>
			</tr>
		{/each}
	</tbody>
</table>
