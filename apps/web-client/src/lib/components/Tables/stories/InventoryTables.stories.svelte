<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import { StockTable, InboundTable, OutboundTable } from "../InventoryTables";

	export const meta: Meta = {
		title: "Tables / Inventory tables",
		subcomponents: { StockTable, InboundTable, OutboundTable }
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	import { writable } from "svelte/store";
	import FileEdit from "$lucide/file-edit";

	import { createTable } from "$lib/actions";

	import { rows, warehouseList, outNoteRows } from "$lib/__testData__/rowData";

	const inboundTable = createTable(
		writable({
			data: rows
		})
	);

	const stockTable = createTable(
		writable({
			// Stock table needs to support custom items as well, as we're using it to display (already) committed notes (both inbound and outbound)
			data: [...rows, { __kind: "custom" as const, id: 1, title: "Custom Item 1", price: 10 }]
		})
	);

	const outboundTable = createTable(writable({ data: outNoteRows }));
</script>

<Story name="Stock">
	<StockTable table={stockTable}>
		<div slot="row-actions" let:row let:rowIx>
			<button on:click={() => console.log(row)} class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
				<span class="sr-only">Edit row {rowIx}</span>
				<span class="aria-hidden">
					<FileEdit />
				</span>
			</button>
		</div>
	</StockTable>
</Story>

<Story name="Inbound">
	<InboundTable table={inboundTable} on:edit-row-quantity={({ detail }) => console.log("Edit Quantity", detail)}>
		<div slot="row-actions" let:row let:rowIx>
			<button on:click={() => console.log(row)} class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
				<span class="sr-only">Edit row {rowIx}</span>
				<span class="aria-hidden">
					<FileEdit />
				</span>
			</button>
		</div>
	</InboundTable>
</Story>

<Story name="Outbound">
	<OutboundTable
		{warehouseList}
		table={outboundTable}
		on:edit-row-warehouse={({ detail }) => console.log("Edit Warehouse", detail)}
		on:edit-row-quantity={({ detail }) => console.log("Edit Quantity", detail)}
	>
		<div slot="row-actions" let:row let:rowIx>
			<button on:click={() => console.log(row)} class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
				<span class="sr-only">Edit row {rowIx}</span>
				<span class="aria-hidden">
					<FileEdit />
				</span>
			</button>
		</div>
	</OutboundTable>
</Story>
