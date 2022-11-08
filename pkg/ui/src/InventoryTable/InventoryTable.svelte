<script lang="ts">
	const columnTitles: string[] = [
		'ISBN',
		'Title',
		'Author',
		'Editor',
		'Quantity',
		'Price',
		'Year',
		'Out Of Print',
		'Edited By',
		'Classification'
	];
</script>

<div class="px-4 sm:px-6 lg:px-8">
	<div class="mt-8 flex flex-col">
		<div class="-my-2 -mx-4 scrollbar-hide overflow-x-auto sm:-mx-6 lg:-mx-8">
			<div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
				<div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
					<table class="min-w-full divide-y divide-gray-300">
						<thead class="bg-gray-50">
							<tr>
								{#each columnTitles as columnTitle (columnTitle)}
									<th
										scope="col"
										class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900"
									>
										{columnTitle}
									</th>
								{/each}
							</tr>
						</thead>

						<tbody class="divide-y  divide-gray-200 bg-white">
							<slot />
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
