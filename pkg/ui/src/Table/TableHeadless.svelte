<script>
	import { readable } from 'svelte/store';
	import { createTable, Subscribe, Render } from 'svelte-headless-table';
	import { addSortBy, addColumnOrder } from 'svelte-headless-table/plugins';

	const data = readable([
		{ ISBN: 917289012312, Titulo: 'Miti Del Nord', Autore: 'Neil Galman' },
		{ ISBN: 917289012314, Titulo: 'Siti Del Nord', Autore: 'Leil Galman' },
		{ ISBN: 917289012310, Titulo: 'Viti Del Nord', Autore: 'Peil Galman' }
	]);

	const table = createTable(data, {
		sort: addSortBy({ disableMultiSort: true, initialSortKeys: [{ id: 'Autore', order: 'asc' }] }),
		colOrder: addColumnOrder()
	});

	const columns = table.createColumns([
		table.column({
			header: 'ISBN TITLE',
			accessor: 'ISBN',
			plugins: {
				sort: { invert: true }
			}
		}),
		table.column({ header: 'Autore TITLE', accessor: 'Autore' }),
		table.column({ header: 'Titulo TITLE', accessor: 'Titulo' })
	]);

	const { headerRows, rows, tableAttrs, tableBodyAttrs, pluginStates } =
		table.createViewModel(columns);

	const { columnIdOrder } = pluginStates.colOrder;
	$columnIdOrder = ['ISBN', 'Autore'];
</script>

<table {...$tableAttrs}>
	<thead>
		{#each $headerRows as headerRow (headerRow.id)}
			<Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
				<tr {...rowAttrs}>
					{#each headerRow.cells as cell (cell.id)}
						<Subscribe attrs={cell.attrs()} let:attrs props={cell.props()} let:props>
							<th {...attrs} on:click={props.sort.toggle}>
								<Render of={cell.render()} />
								{#if props.sort.order === 'asc'}
									⬇️
								{:else if props.sort.order === 'desc'}
									⬆️
								{:else}
									sort
								{/if}
							</th>
						</Subscribe>
					{/each}
				</tr>
			</Subscribe>
		{/each}
	</thead>
	<tbody {...$tableBodyAttrs}>
		{#each $rows as row (row.id)}
			<Subscribe rowAttrs={row.attrs()} let:rowAttrs>
				<tr>
					{#each row.cells as cell (cell.id)}
						<Subscribe attrs={cell.attrs()} let:attrs>
							<td {...attrs}>
								<Render of={cell.render()} />
							</td>
						</Subscribe>
					{/each}
				</tr>
			</Subscribe>
		{/each}
	</tbody>
</table>

<style>
	table {
		font-family: sans-serif;
		border-spacing: 0;
		border-top: 1px solid black;
		border-left: 1px solid black;
	}

	th,
	td {
		margin: 0;
		padding: 0.5rem;
		border-bottom: 1px solid black;
		border-right: 1px solid black;
	}
</style>
