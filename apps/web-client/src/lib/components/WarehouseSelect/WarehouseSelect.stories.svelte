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

	import { outNoteRows, warehouseList } from "$lib/__testData__/rowData";
</script>

<Story name="Default">
	<td>
		<WarehouseSelect scannedQuantitiesPerWarehouse={new Map()} row={outNoteRows[0]} rowIx={0} />
	</td>
</Story>
