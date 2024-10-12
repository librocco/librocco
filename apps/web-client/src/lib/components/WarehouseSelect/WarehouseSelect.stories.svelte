<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import WarehouseSelect from "./WarehouseSelect.svelte";

	export const meta: Meta = {
		title: "Tables / Warehouse Select",
		component: WarehouseSelect
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	import { rows, outNoteRows } from "$lib/__testData__/rowData";
</script>

<Story name="Default">
	<td>
		<WarehouseSelect data={outNoteRows[0]} rowIx={0} />
	</td>
</Story>

<Story name="Only one option - selected">
	<td>
		<WarehouseSelect data={rows[0]} rowIx={1} />
	</td>
</Story>
