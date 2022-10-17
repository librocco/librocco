<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { TableData } from './types';
	import { createTable, Subscribe, Render } from 'svelte-headless-table';
	import { addSortBy, addSelectedRows } from 'svelte-headless-table/plugins';

	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	export let data: Writable<TableData[]>;

	const table = createTable(data, {
		sort: addSortBy({ disableMultiSort: true, initialSortKeys: [{ id: 'Autore', order: 'asc' }] }),
		select: addSelectedRows()
	});

	const columns = table.createColumns([
		table.column({
			header: 'ISBN',
			accessor: 'ISBN',
			plugins: {
				sort: { invert: true },
				select: {}
			}
		}),
		table.column({ header: 'Autore', accessor: 'Autore' }),
		table.column({ header: 'Titulo', accessor: 'Titulo' })
	]);

	const { headerRows, rows, tableAttrs, tableBodyAttrs } = table.createViewModel(columns);
</script>

<div class="px-4 sm:px-6 lg:px-8">
	<div class="mt-8 flex flex-col">
		<div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
			<div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
				<div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
					<table {...$tableAttrs} class="min-w-full divide-y divide-gray-300">
						<thead class="bg-gray-50">
							{#each $headerRows as headerRow (headerRow.id)}
								<Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
									<tr {...rowAttrs}>
										<th scope="col" class="relative w-12 px-6 sm:w-16 sm:px-8">
											<input
												type="checkbox"
												class="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 sm:left-6"
											/>
										</th>

										{#each headerRow.cells as cell (cell.id)}
											<Subscribe attrs={cell.attrs()} let:attrs props={cell.props()} let:props>
												<th
													{...attrs}
													on:click={props.sort.toggle}
													scope="col"
													class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
												>
													<Render of={cell.render()} />

													<!-- svelte-ignore a11y-invalid-attribute -->
													<a href="#" class="group inline-flex">
														<!-- Active: "bg-gray-200 text-gray-900 group-hover:bg-gray-300", Not Active: "invisible text-gray-400 group-hover:visible group-focus:visible" -->
														<div
															class={[
																' ml-2 rounded',
																props.sort.order
																	? 'bg-gray-200 text-gray-900 group-hover:bg-gray-300'
																	: 'invisible text-gray-400 group-hover:visible group-focus:visible'
															].join(' ')}
														>
															<!-- Heroicon name: mini/chevron-down -->
															{#if props.sort.order === 'desc'}
																<ChevronUp class="w-4 h-4" />
															{:else}
																<ChevronDown class="w-4 h-4" />
															{/if}
														</div>
													</a>
												</th>
											</Subscribe>
										{/each}

										<th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
											<span class="sr-only">Edit</span>
										</th>
									</tr>
								</Subscribe>
							{/each}
						</thead>

						<tbody class="divide-y divide-gray-200 bg-white" {...$tableBodyAttrs}>
							{#each $rows as row (row.id)}
								<Subscribe rowAttrs={row.attrs()} let:rowAttrs>
									<!-- Selected: "bg-gray-50" -->
									<tr {...rowAttrs}>
										<td class="relative w-12 px-6 sm:w-16 sm:px-8">
											<!-- Selected row marker, only show when row is selected. -->
											<div class="absolute inset-y-0 left-0 w-0.5 bg-teal-600" />

											<input
												type="checkbox"
												class="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 sm:left-6"
											/>
										</td>
										{#each row.cells as cell (cell.id)}
											<Subscribe attrs={cell.attrs()} let:attrs>
												<!-- Selected: "text-teal-600", Not Selected: "text-gray-900" -->
												<td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500" {...attrs}>
													<Render of={cell.render()} />
												</td>
											</Subscribe>
										{/each}
										<td
											class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6"
										>
											<!-- svelte-ignore a11y-invalid-attribute -->
											<a href="#" class="text-teal-600 hover:text-teal-900">Edit</a>
										</td>
									</tr>
								</Subscribe>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
