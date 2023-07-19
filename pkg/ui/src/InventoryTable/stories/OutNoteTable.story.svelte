<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { writable } from "svelte/store";

	import OutNoteTable from "../OutNoteTable.svelte";
	import TdWarehouseSelect from "../TdWarehouseSelect.svelte";

	import { createTable } from "../table";

	import { rows } from "../__tests__/data";

	export let Hst: Hst;

	const multipleWarehouses = new Map([
		["varia-2018", { displayName: "Varia 2018" }],
		["nuovo-2021", { displayName: "Nuovo 2021" }]
	]);
	const singleWhId = "varia-2018";
	const singleWhDisplayName = "Varia 2018";
	const singleWarehouse = new Map([[singleWhId, { displayName: singleWhDisplayName }]]);

	const outNoteRows = [
		{ ...rows[0], warehouseId: "", warehouseName: "", availableWarehouses: multipleWarehouses },
		{
			...rows[1],
			warehouseId: singleWhId,
			warehouseName: singleWhDisplayName,
			availableWarehouses: singleWarehouse
		}
	];

	const tableOptions = writable({
		data: outNoteRows
	});

	const outNoteTable = createTable(tableOptions);

	const addRows = () => tableOptions.update(({ data }) => ({ data: [...data, outNoteRows[0]] }));
</script>

<Hst.Story title="Tables / Out Note Table">
	<Hst.Variant title="Out Note Table">
		<OutNoteTable table={outNoteTable} />
	</Hst.Variant>

	<Hst.Variant title="Warehouse Select (Table Data)">
		<div class="h-40">
			<table>
				<tbody>
					<TdWarehouseSelect rowIx={1} data={outNoteRows[0]} />
					<TdWarehouseSelect rowIx={0} data={outNoteRows[1]} />
				</tbody>
			</table>
		</div>
	</Hst.Variant>
</Hst.Story>
