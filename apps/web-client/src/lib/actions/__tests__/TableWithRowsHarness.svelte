<script lang="ts">
	import { type createTable } from "$lib/actions/table";

	export let table: ReturnType<typeof createTable<Record<string, unknown>>>;

	const { table: tableAction } = table;
	type TableRow = Record<string, unknown> & { key: string; rowIx: number };
	let rows: TableRow[] = [];
	let rowCount: number = 0;
	$: ({ rows } = $table);
	$: rowCount = rows.length;
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
