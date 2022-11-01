<script lang="ts">
	import type { TableData } from './types';

	export let rowData: TableData;
</script>

<tr>
	{#each Object.values(rowData) as cell}
		<td class="whitespace-nowrap px-3  py-4 text-sm text-gray-900">
			<div class="flex justify-center">
				{cell}
			</div>
		</td>
	{/each}
</tr>
