<script lang="ts">
	import { _group, wrapIter } from "@librocco/shared";

	import type { ReconciliationUnmatchedBookLine, ReconciliationProcessedLine } from "./utils";
	import LL from "@librocco/shared/i18n-svelte";

	export let reconciledBooks: { processedLines: ReconciliationProcessedLine[]; unmatchedBooks: ReconciliationUnmatchedBookLine[] } = {
		processedLines: [],
		unmatchedBooks: []
	};

	// NOTE: potential conflicts if two suppliers have the same name (quite unlikely though)
	$: groupedSupplierBooks = wrapIter(reconciledBooks.processedLines)._groupIntoMap(({ supplier_name, ...rest }) => [supplier_name, rest]);
</script>

<div class="overflow-x-auto">
	<table class="table-pin-rows table">
		<thead>
			<tr>
				<th> {$LL.supplier_orders_component.comparison_table.isbn()}</th>
				<th> {$LL.supplier_orders_component.comparison_table.title()}</th>
				<th> {$LL.supplier_orders_component.comparison_table.authors()}</th>
				<th> {$LL.supplier_orders_component.comparison_table.price()}</th>
				<th> {$LL.supplier_orders_component.comparison_table.ordered_quantity()}</th>
				<th> {$LL.supplier_orders_component.comparison_table.delivered_quantity()}</th>
				<!-- <th class="w-16">
					<span class="sr-only">Delivered</span>
				</th> -->
			</tr>
		</thead>

		{#if reconciledBooks.unmatchedBooks.length}
			<thead>
				<tr class="bg-base-200/50">
					<th colspan="7" class="text-left"> {$LL.supplier_orders_component.comparison_table.unmatched_books()} </th>
				</tr>
			</thead>
			<tbody>
				{#each reconciledBooks.unmatchedBooks as line}
					<tr>
						<td>{line.isbn}</td>
						<td>{line.title}</td>
						<td>{line.authors}</td>
						<td>€{line.price}</td>
						<td></td>
						<td class="text-center">{line.deliveredQuantity}</td>
					</tr>
				{/each}
			</tbody>
		{/if}

		{#each groupedSupplierBooks.entries() as [supplier_name, reconciledBooksList]}
			<thead>
				<tr class="bg-base-200/50">
					<th colspan="7" class="text-left">
						{supplier_name || ""}
					</th>
					<!-- <th colspan="1" class="text-center">
						<span class="badge-accent badge-outline badge-lg badge">
							{getSupplierSummary(reconciledBooks)}
						</span>
					</th> -->
				</tr>
			</thead>

			<tbody>
				{#each reconciledBooksList as { isbn, title, authors, price, deliveredQuantity, orderedQuantity }}
					<tr>
						<td>{isbn}</td>
						<td>{title}</td>
						<td>{authors}</td>
						<td>€{price}</td>
						<td class="text-center">{orderedQuantity}</td>
						<td class="text-center">{deliveredQuantity}</td>
						<td class="text-center">
							<!-- is true if book is in delivered books -->
							<input type="checkbox" checked={deliveredQuantity >= orderedQuantity} disabled class="checkbox" />
						</td>
					</tr>
				{/each}
			</tbody>
		{/each}
	</table>
</div>
