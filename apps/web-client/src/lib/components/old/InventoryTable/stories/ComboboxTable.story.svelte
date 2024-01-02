<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { createCombobox } from "svelte-headlessui";

	import ComboboxTable from "../ComboboxTable.svelte";
	import { TextField } from "$lib/components";

	import { rows } from "./data";

	export let Hst: Hst;

	const combobox = createCombobox({ label: "Test Table combobox", expanded: true });

	const xeroQuantityRow = { ...rows[0], quantity: 0 };
</script>

<Hst.Story title="Tables / Combobox Table">
	<div class="h-96 overflow-hidden">
		<div class="relative">
			<TextField name="search-books" placeholder="Search for books" inputAction={combobox.input} value={$combobox.selected?.title} />
			<ComboboxTable rows={[xeroQuantityRow, ...rows]} {combobox} />
		</div>
	</div>
</Hst.Story>
