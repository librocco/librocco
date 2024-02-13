<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import WarehouseSelect from "./WarehouseSelect.svelte";

	import { rows, outNoteRows } from "$lib/__testData__/rowData";

	export let Hst: Hst;
</script>

<Hst.Story title="Warehouse Select" layout={{ type: "grid", width: 500 }}>
	<Hst.Variant title="Default">
		<td>
			<WarehouseSelect data={outNoteRows[0]} rowIx={0} />
		</td>
	</Hst.Variant>

	<Hst.Variant title="Only one option - selected">
		<td>
			<WarehouseSelect data={rows[0]} rowIx={1} />
		</td>
	</Hst.Variant>
</Hst.Story>
