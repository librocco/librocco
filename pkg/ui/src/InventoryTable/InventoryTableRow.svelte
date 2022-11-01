<script lang="ts">
	import type { TableData } from './types';

	export let rowData: TableData;
	export let className = '';
</script>

<tr class={className}>
	{#each Object.values(rowData) as cell, index}
		<td
			class={[
				'whitespace-nowrap py-2 text-sm',
				index ? 'px-2 text-gray-500' : 'pl-4 pr-3 font-medium text-gray-900 sm:pl-6'
			].join(' ')}
		>
			<div>
				{cell}
			</div>
		</td>
	{/each}
</tr>
