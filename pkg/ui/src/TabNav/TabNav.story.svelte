<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { TabContext, TabList, TabPanel } from './index';

	const tabNames = ['Agglungi con codice', 'Cerca libri da caricare', 'Crea nuovo libro'];

	export let Hst: Hst;
</script>

<Hst.Story title="TabNav" layout={{ type: 'grid', width: 600 }}>
	<TabContext>
		<TabList {tabNames} />

		<TabPanel tabIx={0}>
			<div class="w-full border px-6 pt-2 text-gray-900">
				<h2 class="text-md font-bold">Panel 1</h2>
				<p>Agglungi con codice content</p>
			</div>
		</TabPanel>

		<TabPanel tabIx={1}>
			<div class="w-full border px-6 pt-2 text-gray-900">
				<h2 class="text-md font-bold">Panel 2</h2>
				<p>Cerca libri da caricare content</p>
			</div>
		</TabPanel>

		<TabPanel tabIx={2}>
			<div class="w-full border px-6 pt-2 text-gray-900">
				<h2 class="text-md font-bold">Panel 3</h2>
				<p>Crea nuovo libro content</p>
			</div>
		</TabPanel>
	</TabContext>
</Hst.Story>
