<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { writable } from "svelte/store";
	import { FileEdit } from "lucide-svelte";

	import StockTable from "../InventoryTables/StockTable.svelte";

	import { createTable } from "$lib/actions";

	import { rows } from "../../InventoryTable/__tests__/data";

	export let Hst: Hst;

	const tableOptions = writable({
		data: rows
	});

	const defaultStockTable = createTable(tableOptions);
</script>

<Hst.Story title="Tables / Inventory Tables">
	<Hst.Variant title="Stock">
		<StockTable table={defaultStockTable}>
			<div slot="row-actions" let:row let:rowIx>
				<button on:click={() => console.log(row)} class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
					<span class="sr-only">Edit row {rowIx}</span>
					<span class="aria-hidden">
						<FileEdit />
					</span>
				</button>
			</div>
		</StockTable>
	</Hst.Variant>
</Hst.Story>
