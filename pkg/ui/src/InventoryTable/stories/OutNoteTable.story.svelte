<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import OutNoteTable from '../OutNoteTable.svelte';
	import TdWarehouseSelect from '../TdWarehouseSelect.svelte';

	import { createTable } from '../table';

	import { rows } from '../__tests__/data';

	export let Hst: Hst;

	const multipleWarehouses = ['Varia 2018', 'Nuovo 2021'];
	const singleWarehouse = ['Varia 2018'];

	const outNoteRows = [
		{ ...rows[0], warehouses: multipleWarehouses },
		{ ...rows[1], warehouses: singleWarehouse }
	];

	const outNoteTable = createTable({ rows: outNoteRows });
</script>

<Hst.Story title="Tables / Out Note Table">
	<Hst.Variant title="Out Note Table">
		<OutNoteTable table={outNoteTable} />
	</Hst.Variant>

	<Hst.Variant title="Warehouse Select (Table Data)">
		<table>
			<tbody>
				<TdWarehouseSelect rowIx={1} data={outNoteRows[0]} />
				<TdWarehouseSelect rowIx={0} data={outNoteRows[1]} />
			</tbody>
		</table>
	</Hst.Variant>
</Hst.Story>
