<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { writable } from "svelte/store";

	import { PenLine, X } from "lucide-svelte";

	import NewStockTable from "../NewStockTable.svelte";

	import { createTable } from "../table";

	import { rows } from "../__tests__/data";

	export let Hst: Hst;

	const tableOptions = writable({
		data: rows
	});

	const defaultStockTable = createTable(tableOptions);

	const addRows = () => tableOptions.update(({ data }) => ({ data: [...data, rows[0]] }));
</script>

<Hst.Story title="Tables / New Tables">
	<Hst.Variant title="Stock">
		<NewStockTable table={defaultStockTable}>
			<div slot="row-actions" let:row let:rowIx>
				<button on:click={() => console.log(row)} class="rounded p-3 hover:bg-gray-50 hover:text-gray-900">
					<span class="sr-only">Edit row {rowIx}</span>
					<span class="aria-hidden">
						<PenLine size={20} />
					</span>
				</button>
			</div>
		</NewStockTable>
	</Hst.Variant>
</Hst.Story>
