<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';

	import { Tabs, TabList, TabPanel, Tab } from './index';
</script>

<Meta title="Components: TabNav" />

<Story name="TabNav">
	<Tabs>
		<TabList>
			<Tab classes=" w-[33%] h-10 justify-center">Agglungi con codice</Tab>
			<Tab classes="w-[33%] h-10 justify-center">Cerca libri da caricare</Tab>
			<Tab classes="w-[33%] h-10 justify-center">Crea nuovo libro</Tab>
		</TabList>

		<TabPanel>
			<h2>Agglungi con codice panel</h2>
		</TabPanel>

		<TabPanel>
			<h2>Cerca libri da caricare panel</h2>
		</TabPanel>

		<TabPanel>
			<h2>Crea nuovo libro</h2>
		</TabPanel>
	</Tabs>
</Story>
