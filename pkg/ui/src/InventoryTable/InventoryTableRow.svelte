<script lang="ts">
	import type { TableData } from './types';
	export let data: Partial<TableData>;

	const cols: (keyof TableData)[] = [
		'isbn',
		'title',
		'author',
		'editor',
		'quantity',
		'price',
		'year',
		'outOfPrint',
		'editedBy',
		'classification'
	];
</script>

<tr class="whitespace-nowrap text-sm text-gray-500 even:bg-gray-50 ">
	{#each cols as col}
		<td class="py-2 pl-4 first:font-medium first:text-gray-900">
			{data[col] ?? 'N/A'}
		</td>
	{/each}
</tr>
