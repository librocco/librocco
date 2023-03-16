<script lang="ts">
	import type { BookCoreRowData } from '../types';

	export let data: BookCoreRowData;

	$: ({ isbn, title, authors, year, quantity, price } = data);
</script>

<th scope="row" class="py-4 px-3 text-left font-medium text-gray-800 lg:w-auto lg:max-w-none">
	{isbn}
	<dl class="font-normal lg:hidden">
		<dt class="sr-only">Title:</dt>
		<dd class="mt-1 truncate font-light text-gray-500">{title}</dd>
		<dt class="sr-only lg:hidden">Authors:</dt>
		<dd class="mt-1 truncate font-light text-gray-500 lg:hidden">{authors}</dd>
		<dt class="sr-only sm:hidden">Year:</dt>
		<dd class="mt-1 truncate font-light text-gray-500 sm:hidden">{year}</dd>
	</dl>
</th>
<td class="hidden px-3 py-4 lg:table-cell">
	{title}
</td>
<td class="hidden py-4 px-3 lg:table-cell">
	{authors}
</td>
<td class="py-4 px-3 text-left">
	<span class="rounded-md bg-gray-100 px-3 py-2">
		{quantity}
	</span>
</td>
<td class="py-4 px-3 text-left">
	{price}
</td>
<td class="hidden py-4 px-3 text-left sm:table-cell">
	{year}
</td>
