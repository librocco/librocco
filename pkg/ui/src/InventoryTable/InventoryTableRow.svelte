<script lang="ts">
	import type { TableData } from './types';
	export let isbn: TableData['isbn'] = undefined;
	export let title: TableData['title'] = undefined;
	export let author: TableData['author'] = undefined;
	export let editor: TableData['editor'] = undefined;
	export let quantity: TableData['quantity'] = undefined;
	export let price: TableData['price'] = undefined;
	export let year: TableData['year'] = undefined;
	export let outOfPrint: TableData['outOfPrint'] = undefined;
	export let editedBy: TableData['editedBy'] = undefined;
	export let classification: TableData['classification'] = undefined;

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
			{col ?? 'N/A'}
		</td>
	{/each}
</tr>
