<script lang="ts">
	import type { TableData } from './types';
	import { Checkbox } from '../';

	export let rows: TableData[];

	const columnTitles: string[] = [
		'ISBN',
		'Title',
		'Author',
		'Quantity',
		'Price',
		'Edited By',
		'Out of Print',
		'Year'
	];
</script>

<div class="overflow-x-auto">
	<table class="min-w-full divide-y divide-gray-200 bg-white">
		<thead>
			<tr>
				<th scope="col" class="px-2">
					<Checkbox name="Select all" />
				</th>
				{#each columnTitles as columnTitle (columnTitle)}
					<th
						scope="col"
						class="whitespace-nowrap py-2 px-3  text-left text-sm font-medium uppercase tracking-wide text-gray-500"
					>
						{columnTitle}
					</th>
				{/each}
			</tr>
		</thead>

		<tbody>
			{#each rows as { isbn, title, author, quantity, price, year, outOfPrint, editedBy } (isbn)}
				<tr class="whitespace-nowrap text-sm font-light text-gray-500 even:bg-gray-50">
					<td class="px-2">
						<span class="inline-block">
							<Checkbox name={`Select ${title}`} />
						</span>
					</td>
					<th scope="row" class="py-4 px-3 font-medium text-gray-800">
						{isbn}
					</th>
					<td class="py-4 px-3">
						{title}
					</td>
					<td class="py-4 px-3">
						{author}
					</td>
					<td class="py-4 px-3 text-center">
						{quantity}
					</td>
					<td class="py-4 px-3 text-center">
						{price}
					</td>

					<td class="py-4 px-3">
						{editedBy}
					</td>
					<td class="py-4 px-3 text-center">
						<span class="inline-block">
							<Checkbox name={`${title} is out of print: ${outOfPrint}`} checked={outOfPrint} disabled />
						</span>
					</td>
					<td class="py-4 px-3 text-center">
						{year}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
