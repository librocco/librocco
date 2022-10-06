<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';

	import { TabContext, TabList, TabPanel } from './index';

	const tabsList = ['Agglungi con codice', 'Cerca libri da caricare', 'Crea nuovo libro'];

	// NOTE: Small screen select and regular tabs will not appear synced in storybook pen
	// Try viewing the story as a pop out ;)
</script>

<Meta title="TabNav" />

<Story name="TabNav">
	<TabContext>
		<TabList tabs={tabsList} />

		<TabPanel tabIx={0}>
			<h2>Agglungi con codice panel</h2>
		</TabPanel>

		<TabPanel tabIx={1}>
			<h2>Cerca libri da caricare panel</h2>
		</TabPanel>

		<TabPanel tabIx={2}>
			<h2>Crea nuovo libro</h2>
		</TabPanel>
	</TabContext>
</Story>
