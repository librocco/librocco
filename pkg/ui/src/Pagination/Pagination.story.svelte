<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import Pagination from './Pagination.svelte';

	export let Hst: Hst;

	const links = Array(12)
		.fill(null)
		.map((_, i) => `link-${i + 1}`);

	// #region interactiveState
	let currentItem = 0;
	// #endregion interactiveState

	// #region differentStates
	const states = [2, 4, 9, 0, 11];
	const stateLabels = [
		'Current item near start',
		'Current item at center',
		'Current item near end',
		'First (Previous button disabled)',
		'Last (Next button disabled)'
	];
	// #endregion differentStates
</script>

<Hst.Story title="Pagination" layout={{ type: 'grid', width: 500 }}>
	<Hst.Variant title="Interactive">
		<Pagination {currentItem} onPaginate={(_, i) => (currentItem = i)} maxItems={6} {links} />
	</Hst.Variant>
	<Hst.Variant title="Max Items: 5">
		{#each states as currentItem, i}
			<div class="mb-4">
				<h1 class="text-gray-900">{stateLabels[i]}</h1>
				<Pagination maxItems={5} {currentItem} {links} />
			</div>
		{/each}
	</Hst.Variant>
	<Hst.Variant title="Max Items: 7">
		{#each states as currentItem, i}
			<div class="mb-4">
				<h1 class="text-gray-900">{stateLabels[i]}</h1>
				<Pagination maxItems={7} {currentItem} {links} />
			</div>
		{/each}
	</Hst.Variant>
</Hst.Story>
