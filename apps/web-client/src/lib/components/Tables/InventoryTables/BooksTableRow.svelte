<script lang="ts">
	import type { BookData } from "@librocco/shared";

	import BookHeadCell from "./BookHeadCell.svelte";
	import BookOutPrintCell from "./BookOutPrintCell.svelte";

	export let row: Required<BookData>;
	export let rowIx: number;

	const isbn = row.isbn;
	const authors = row.authors;
	const year = row.year;
	const title = row.title;
	const price = row.price;
	const publisher = row.publisher;
	const editedBy = row.editedBy;
	const category = row.category;
	const outOfPrint = row.outOfPrint;
</script>

<th scope="row" class="table-cell-max">
	<BookHeadCell data={{ isbn, title, authors, year }} />
</th>

<td data-property="title" class="show-col-lg table-cell-max">
	{title}
</td>
<td data-property="authors" class="show-col-lg table-cell-max">
	{authors}
</td>
<td data-property="price" class="">
	<span data-property="full-price">€{price.toFixed(2)}</span>
</td>
<td data-property="publisher" class="show-col-sm table-cell-max">
	{publisher}
</td>
<td data-property="year" class="show-col-lg">
	{year}
</td>
<td data-property="editedBy" class="show-col-xl table-cell-max">
	{editedBy}
</td>
<td data-property="outOfPrint" class="show-col-xl">
	<BookOutPrintCell {rowIx} {outOfPrint} />
</td>
<td data-property="category" class="show-col-xl table-cell-max">
	{category}
</td>

{#if $$slots["row-actions"]}
	<td class="table-cell-fit">
		<slot name="row-actions" {row} {rowIx} />
	</td>
{/if}
