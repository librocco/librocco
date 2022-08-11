<script lang="ts">
	import { Meta, Story, Template } from '@storybook/addon-svelte-csf';

	import { StorybookItem, StorybookGrid } from '../utils/stories';
	import Pagination from './Pagination.svelte';

	const links = Array(12)
		.fill(null)
		.map((_, i) => `link-${i + 1}`);

	// #region interactiveState
	let currentItem = 0;
	// #endregion interactiveState

	// #region differentStates
	const stateLabels = [
		'Current item near start',
		'Current item at center',
		'Current item near end',
		'First (Previous button disabled)',
		'Last (Next button disabled)'
	];
	// #endregion differentStates
</script>

<Meta title="Pagination" />

<Story name="Interactive">
	<div>
		<h1 class="mb-2 font-bold">Interactive</h1>
		<p class="mb-8 ml-4 italic text-gray-500 w-sm">
			Pagination is a stateless component (current item is controlled from outside and passed as
			props). Only this story is interactive as it keeps state wrapped around the rendered
			component.
		</p>
		<Pagination {currentItem} onPaginate={(_, i) => (currentItem = i)} maxItems={6} {links} />
	</div>
</Story>

<Template id="States" let:args={{ cols, maxItems, states }}>
	<h1 class="mb-8 font-bold">Max Items: {maxItems}</h1>
	<StorybookGrid {cols}>
		{#each states as currentItem, i}
			<StorybookItem class="mb-4" label={stateLabels[i]}>
				<Pagination {maxItems} {currentItem} {links} />
			</StorybookItem>
		{/each}
	</StorybookGrid>
</Template>

<Story
	name="Max Items: 5"
	template="States"
	args={{
		cols: 3,
		maxItems: 5,
		states: [2, 4, 9, 0, 11]
	}}
/>

<Story
	name="Max Items: 7"
	template="States"
	args={{
		cols: 2,
		maxItems: 7,
		states: [2, 4, 9, 0, 11]
	}}
/>
