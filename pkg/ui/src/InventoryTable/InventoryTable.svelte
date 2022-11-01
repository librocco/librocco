<script lang="ts">
	export let headerRows: string[] = [
		'ISBN',
		'Title',
		'Author',
		'Editor',
		'Quantity',
		'Price',
		'Year',
		'OutOfPrint',
		'EditedBy',
		'Classification'
	];
</script>

<div class="px-4 sm:px-6 lg:px-8">
	<div class="mt-8 flex flex-col">
		<div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
			<div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
				<div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
					<table class="min-w-full divide-y divide-gray-300">
						<thead class="bg-gray-50">
							<tr>
								{#each headerRows as headerRow (headerRow)}
									<th
										scope="col"
										class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
									>
										<!-- svelte-ignore a11y-invalid-attribute -->
										<a href="#" class="group">
											<div class="flex justify-center">
												{headerRow}
											</div>
										</a>
									</th>
								{/each}
							</tr>
						</thead>

						<tbody class="divide-y divide-gray-200 bg-white">
							<slot />
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
