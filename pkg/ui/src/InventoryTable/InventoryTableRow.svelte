<script lang="ts">
	import type { TableData } from './types';
	export let isbn;
	export let title;
	export let author;
	export let editor;
	export let quantity;
	export let price;
	export let year;
	export let outOfPrint;
	export let editedBy;
	export let classification;

	const cols: TableData = {
		isbn,
		title,
		author,
		editor,
		quantity,
		price,
		year,
		outOfPrint,
		editedBy,
		classification
	};
</script>

<tr class="even:bg-gray-50 whitespace-nowrap text-sm text-gray-500 ">
	{#each Object.values(cols) as col}
		<td class="first:text-gray-900 first:font-medium py-2 pl-4">
			{col || 'N/A'}
		</td>
	{/each}
</tr>
