<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';

	import { TabContext, TabList, TabPanel } from './index';

	const tabNames = ['Agglungi con codice', 'Cerca libri da caricare', 'Crea nuovo libro'];
</script>

<Meta title="TabNav" />

<Story name="TabNav">
	<div>
		<p class="text-sm mb-4">
			{`Note: Each tab behaves as a <a> with href=#tabName. 
			It's better to view this story in the popout canvas (top right) before clicking any tabs.`}
		</p>
		<TabContext>
			<TabList {tabNames} />

			<TabPanel tabIx={0}>
				<div class="w-full border pt-2 px-6">
					<h2 class="font-bold text-md">Panel 1</h2>
					<p>Agglungi con codice content</p>
				</div>
			</TabPanel>

			<TabPanel tabIx={1}>
				<div class="w-full border pt-2 px-6">
					<h2 class="font-bold text-md">Panel 2</h2>
					<p>Cerca libri da caricare content</p>
				</div>
			</TabPanel>

			<TabPanel tabIx={2}>
				<div class="w-full border pt-2 px-6">
					<h2 class="font-bold text-md">Panel 3</h2>
					<p>Crea nuovo libro content</p>
				</div>
			</TabPanel>
		</TabContext>
	</div>
</Story>
