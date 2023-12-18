<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { writable } from "svelte/store";

	import { FileEdit } from "lucide-svelte";

	import NewStockTable from "../NewStockTable.svelte";

	import { createTable } from "../table";

	import { rows } from "../__tests__/data";

	export let Hst: Hst;

	const tableOptions = writable({
		data: rows
	});

	const defaultStockTable = createTable(tableOptions);
</script>

<Hst.Story title="Tables / New Tables">
	<Hst.Variant title="Stock">
		<NewStockTable table={defaultStockTable}>
			<div slot="row-actions" let:row let:rowIx>
				<button on:click={() => console.log(row)} class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
					<span class="sr-only">Edit row {rowIx}</span>
					<span class="aria-hidden">
						<FileEdit />
					</span>
				</button>
			</div>
		</NewStockTable>
	</Hst.Variant>

	<Hst.Variant title="Inbound">
		<NewStockTable table={defaultStockTable}>
			<div slot="row-quantity" let:quantity class="odd:bg-gray-50 even:bg-white">
				<input
					value={quantity}
					class="w-full rounded border-2 border-gray-500 text-center  focus:border-teal-500 focus:ring-0"
					type="number"
				/>
			</div>
			<div slot="row-actions" let:row let:rowIx>
				<button on:click={() => console.log(row)} class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
					<span class="sr-only">Edit row {rowIx}</span>
					<span class="aria-hidden">
						<FileEdit />
					</span>
				</button>
			</div>
		</NewStockTable>
	</Hst.Variant>
</Hst.Story>

<style>
	/* Chrome, Safari, Edge, Opera */
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	input[type="number"] {
		appearance: textfield;
		-moz-appearance: textfield;
	}
</style>
