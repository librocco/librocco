<script lang="ts">
	import type { PageData } from "./$types";
	export let data: PageData;
	$: ({ notes, date } = data);
	const printDate = new Date().toLocaleDateString();
</script>

<header>
	<h1>Printable Past Notes - {date}</h1>
	<p class="print-date">Printed on: {printDate}</p>
</header>
{#if notes.length}
	<table>
		<thead>
			<tr>
				<th>Warehouse</th>
				<th>Display Name</th>
				<th>Total Books</th>
				<th>Total Cover Price</th>
				<th>Total Discounted Price</th>
				<th>Committed At</th>
			</tr>
		</thead>
		<tbody>
			{#each notes as note}
				<tr>
					<td>{note.warehouseName}</td>
					<td>{note.displayName}</td>
					<td>{note.totalBooks}</td>
					<td>{note.totalCoverPrice.toFixed(2)}</td>
					<td>{note.totalDiscountedPrice.toFixed(2)}</td>
					<td>{new Date(note.committedAt).toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p>No notes found for this date.</p>
{/if}
<div data-date={date}></div>
<!-- Element for attr() -->
<div class="print-date-footer">Printed on: {printDate}</div>

<style>
	:global(body) {
		font-family: Arial, sans-serif;
		margin: 0;
		padding: 0;
	}
	header {
		text-align: center;
		margin-bottom: 20px;
		border-bottom: 1px solid #ccc;
		padding-bottom: 10px;
	}
	header h1 {
		font-size: 1.5em;
		margin: 0;
	}
	.print-date {
		font-size: 0.8em;
		color: #555;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9em;
	}
	th,
	td {
		border: 1px solid black;
		padding: 6px;
		text-align: left;
	}
	th {
		background-color: #f0f0f0;
	}
	p {
		font-size: 0.9em;
	}

	@media print {
		:global(body) {
			margin: 20mm; /* Add margins for printing */
		}
		header {
			display: none; /* Default header hidden, use running headers if possible or rely on @page */
		}
		/* Attempt to repeat table headers on each page if browser supports it */
		thead {
			display: table-header-group;
		}
		/* Avoid breaking rows across pages */
		tr {
			page-break-inside: avoid;
		}
		/* Add a custom header for print */
		@page {
			@top-center {
				content: "Past Notes - " attr(data-date); /* Needs data-date attribute on a relevant element */
				font-size: 10pt;
				color: #333;
			}
			@bottom-center {
				content: "Page " counter(page) " of " counter(pages);
				font-size: 9pt;
			}
		}
		.print-date-footer {
			display: block;
			text-align: right;
			font-size: 0.8em;
			margin-top: 10px;
		}
	}
</style>
