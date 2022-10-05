<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';

	import { Tabs, TabList, TabPanel, Tab } from './index';
</script>

<Meta title="Components: TabNav" />

<Story name="TabNav">
	<Tabs>
		<TabList>
			<Tab name="Agglungi con codice" />
			<Tab name="Cerca libri da caricare" />
			<Tab name="Crea nuovo libro" />
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
