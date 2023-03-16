<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { Button, ButtonColor } from '../Button';

	import { OutNoteTableData } from './TableData';
	import InventoryTable from './InventoryTable.svelte';
	import { createTable } from './table';

	import { InventoryTableVariant } from './enums';

	import { rows } from './__tests__/data';

	export let Hst: Hst;

	const defaultStockTable = createTable({ rows });

	const multipleWarehouses = ['Varia 2018', 'Nuovo 2021'];
	const singleWarehouse = ['Varia 2018'];

	const outNoteRows = [
		{ ...rows[0], warehouses: multipleWarehouses },
		{ ...rows[1], warehouses: singleWarehouse }
	];

	const outNoteTable = createTable({ rows: outNoteRows });
</script>

<Hst.Story title="Tables / Inventory Table">
	<Hst.Variant title="Default - Stock & In Note Table">
		<div class="flex flex-col gap-y-4">
			<div class="w-24 p-1">
				<Button color={ButtonColor.Primary} on:click={() => defaultStockTable.addRows([rows[0]])}
					>Add row</Button
				>
			</div>

			<InventoryTable table={defaultStockTable} />
		</div>
	</Hst.Variant>

	<Hst.Variant title="Out Note Table">
		<InventoryTable table={outNoteTable} variant={InventoryTableVariant.OutNote} />
	</Hst.Variant>

	<Hst.Variant title="Warehouse Select (OutNote Table Row)">
		<table>
			<tbody>
				<OutNoteTableData rowIx={0} data={{ warehouses: singleWarehouse }} />
				<OutNoteTableData rowIx={1} data={{ warehouses: multipleWarehouses }} />
			</tbody>
		</table>
	</Hst.Variant>
</Hst.Story>
