<script lang="ts">
	import type { PageData } from "./$types";
	import { onMount } from "svelte";
	import LL from "@librocco/shared/i18n-svelte"; // For localization, if needed for dates/currency
	import { generateUpdatedAtString } from "$lib/utils/time"; // For formatting dates

	export let data: PageData;

	$: ({ displayName, warehouseName, updatedAt, entries, customItems } = data);

	// Combine book entries and custom items for a single table
	$: allItems = [
		...(entries?.map((e) => ({
			type: "Book",
			isbn: e.isbn,
			title: e.title,
			authors: e.authors,
			publisher: e.publisher,
			year: e.year,
			price: e.price,
			quantity: e.quantity,
			name: null // For consistent structure
		})) || []),
		...(customItems?.map((ci) => ({
			type: "Custom Item",
			name: ci.name,
			quantity: ci.quantity,
			price: ci.price,
			isbn: null, // For consistent structure
			title: null,
			authors: null,
			publisher: null,
			year: null
		})) || [])
	];

	onMount(() => {
		// Optional: Automatically trigger print dialog when page loads
		// window.print();
	});

	function triggerPrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Printable Note - {displayName}</title>
</svelte:head>

<div class="printable-note">
	<header>
		<h1>Note: {displayName}</h1>
		{#if warehouseName}
			<p><strong>Warehouse:</strong> {warehouseName}</p>
		{/if}
		{#if updatedAt}
			<p><strong>Committed Date:</strong> {generateUpdatedAtString(updatedAt)}</p>
		{/if}
		<button on:click={triggerPrint} class="print-button">Print this page</button>
	</header>

	{#if allItems.length > 0}
		<table>
			<thead>
				<tr>
					<th>Type</th>
					<th>Name/Title</th>
					<th>ISBN</th>
					<th>Authors</th>
					<th>Publisher</th>
					<th>Year</th>
					<th>Quantity</th>
					<th>Price</th>
					<th>Total Price</th>
				</tr>
			</thead>
			<tbody>
				{#each allItems as item}
					<tr>
						<td>{item.type}</td>
						<td>{item.type === 'Book' ? item.title : item.name}</td>
						<td>{item.isbn || 'N/A'}</td>
						<td>{item.authors || 'N/A'}</td>
						<td>{item.publisher || 'N/A'}</td>
						<td>{item.year || 'N/A'}</td>
						<td class="text-right">{item.quantity}</td>
						<td class="text-right">
							{#if item.price != null}
								{$LL.formatCurrency(item.price)}
							{:else}
								N/A
							{/if}
						</td>
						<td class="text-right">
							{#if item.price != null && item.quantity != null}
								{$LL.formatCurrency(item.price * item.quantity)}
							{:else}
								N/A
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p>No items found in this note.</p>
	{/if}
</div>

<style>
	.printable-note {
		font-family: Arial, sans-serif;
		margin: 20px;
		color: #000; /* Ensure text is black for printing */
	}
	header {
		margin-bottom: 20px;
		border-bottom: 1px solid #ccc;
		padding-bottom: 10px;
	}
	h1 {
		font-size: 24px;
		margin-bottom: 5px;
	}
	p {
		font-size: 14px;
		margin-bottom: 5px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 20px;
	}
	th, td {
		border: 1px solid #ddd;
		padding: 8px;
		text-align: left;
		font-size: 12px; /* Smaller font for table content */
	}
	th {
		background-color: #f2f2f2;
		font-weight: bold;
	}
	.text-right {
		text-align: right;
	}
	.print-button {
		padding: 8px 12px;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	@media print {
		body {
			font-size: 12pt;
			margin: 0;
			padding: 0;
			background-color: #fff; /* Ensure background is white */
			color: #000; /* Ensure text is black */
		}
		.printable-note {
			margin: 10mm; /* Standard print margin */
			box-shadow: none;
		}
		.print-button {
			display: none;
		}
		header {
			border-bottom: 1px solid #000; /* Use black for print */
		}
		table, th, td {
			border: 1px solid #000; /* Use black for print */
			font-size: 10pt; /* Adjust for print density */
		}
		th {
			background-color: #eee; /* Lighter grey for print */
		}
		/* Avoid page breaks inside rows if possible */
		tr {
			page-break-inside: avoid;
		}
		/* Ensure links (if any accidentally included) are printed clearly */
		a {
			color: #000 !important;
			text-decoration: none !important;
		}
	}
</style>
