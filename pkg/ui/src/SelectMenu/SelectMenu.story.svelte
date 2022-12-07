<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { SelectMenu } from './index';

	export let Hst: Hst;

	const options = [
		{ value: 'draft', description: 'This note will save automatically as a draft transaction.' },
		{
			action: 'Publish',
			value: 'published',
			description: 'This note will be commited to the warehouse. Requires confirmation.'
		},
		{ title: 'Delete', value: 'deleted', description: 'This note will be permenantly deleted. Requires confirmation.' }
	];
</script>

<Hst.Story title="SelectMenu" layout={{ type: 'grid', width: 500 }}>
	<Hst.Variant title="Default">
		<SelectMenu class="mb-[260px]" {options} />
	</Hst.Variant>
	<Hst.Variant title="Disabled">
		<SelectMenu {options} disabled />
	</Hst.Variant>
	<Hst.Variant title="Open left">
		<SelectMenu class="mb-[260px]" {options} />
	</Hst.Variant>
	<Hst.Variant title="Open right">
		<SelectMenu class="mb-[260px] ml-[150px]" {options} open align="right" />
	</Hst.Variant>
</Hst.Story>
