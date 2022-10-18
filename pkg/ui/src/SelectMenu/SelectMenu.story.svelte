<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { SelectMenu } from './index';

	import { AlignContainerEdge } from './enums';

	export let Hst: Hst;

	const options = [
		{
			title: 'Published',
			description: 'This job posting can be viewed by anyone who has the link.'
		},
		{ title: 'Draft', description: 'This job posting will no longer be publicly accessible.' }
	];
</script>

<Hst.Story title="SelectMenu" layout={{ type: 'grid', width: 500 }}>
	<SelectMenu
		{options}
		alignItemsEdge={AlignContainerEdge.Left}
		ariaLabel="Change published status"
	/>
</Hst.Story>
