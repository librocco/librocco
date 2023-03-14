<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import OutNoteRow from './OutNoteRow.svelte';
	import OutNoteTable from './OutNoteTable.svelte';
	import { createTable } from './table';

	import { rows } from './__tests__/data';

	export let Hst: Hst;

	const multipleWarehouses = ['Varia 2018', 'Nuovo 2021'];
	const singleWarehouse = ['Varia 2018'];

	const outNoteRows = [
		{ ...rows[0], warehouses: multipleWarehouses },
		{ ...rows[1], warehouses: singleWarehouse }
	];

	const table = createTable({ rows: outNoteRows });
	const row = { ...rows[0], key: '123', rowIx: 1 };
</script>

<Hst.Story title="Tables / Out Note Table">
	<Hst.Variant title="Out Note Row">
		<table>
			<tbody>
				<OutNoteRow row={{ ...row, warehouses: singleWarehouse }} {table} />
				<OutNoteRow row={{ ...row, warehouses: multipleWarehouses }} {table} />
			</tbody>
		</table>
	</Hst.Variant>
	<Hst.Variant title="Out Note Table">
		<OutNoteTable {table} />
	</Hst.Variant>
</Hst.Story>
