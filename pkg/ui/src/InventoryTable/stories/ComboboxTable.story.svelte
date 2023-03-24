<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { createCombobox } from 'svelte-headlessui';

	import ComboboxTable from '../ComboboxTable.svelte';
	import { TextField } from '../..//FormFields';

	import { rows } from '../__tests__/data';

	export let Hst: Hst;

	const combobox = createCombobox({ label: 'Test Table combobox', expanded: true });

	const xeroQuantityRow = { ...rows[0], quantity: 0 };
</script>

<Hst.Story title="Tables / Combobox Table">
	<div class="h-96 overflow-hidden">
		<div class="relative">
			<TextField
				name="search-books"
				placeholder="Search for books"
				inputAction={combobox.input}
				value={$combobox.selected?.title}
			/>
			<ComboboxTable rows={[xeroQuantityRow, ...rows]} {combobox} on:select={(e) => console.log(e)} />
		</div>
	</div>
</Hst.Story>
