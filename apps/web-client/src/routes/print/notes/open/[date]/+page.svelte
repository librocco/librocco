<script lang="ts">
	import type { PageData } from "./$types";
	import { onMount } from "svelte";
	import LL from "@librocco/shared/i18n-svelte"; // For localization
	import { generateUpdatedAtString } from "$lib/utils/time"; // For formatting dates

	export let data: PageData;

	$: ({ date, notes } = data); // notes are EnrichedPastNoteItem[]

	onMount(() => {
		// Optional: Automatically trigger print dialog when page loads
		// window.print();
	});

	function triggerPrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Printable Daily Summary - {date}</title>
</svelte:head>

<div class="printable-daily-summary">
	<header class="no-print">
		<h1>Printable Daily Notes Summary - {date}</h1>
		<button on:click={triggerPrint} class="print-button">Print this page</button>
	</header>

	{#if notes && notes.length > 0}
		{#each notes as note (note.id)}
			<section class="note-section">
				<h2>Note: {note.displayName}</h2>
				{#if note.warehouseName}
					<p><strong>Warehouse:</strong> {note.warehouseName}</p>
				{/if}
				{#if note.committedAt}
					<p><strong>Committed Time:</strong> {generateUpdatedAtString(note.committedAt)}</p>
				{/if}

				{#if (note.entries && note.entries.length > 0) || (note.customItems && note.customItems.length > 0)}
					<table>
						<thead>
							<tr>
								<th>Type</th>
								<th>Name/Title</th>
								<th>ISBN</th>
								<th>Quantity</th>
								<th>Price</th>
								<th>Total Price</th>
							</tr>
						</thead>
						<tbody>
							{#each note.entries || [] as item}
								<tr>
									<td>Book</td>
									<td>{item.title}</td>
									<td>{item.isbn || 'N/A'}</td>
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
							{#each note.customItems || [] as customItem}
								<tr>
									<td>Custom Item</td>
									<td>{customItem.name}</td>
									<td>N/A</td>
									<td class="text-right">{customItem.quantity}</td>
									<td class="text-right">
										{#if customItem.price != null}
											{$LL.formatCurrency(customItem.price)}
										{:else}
											N/A
										{/if}
									</td>
									<td class="text-right">
										{#if customItem.price != null && customItem.quantity != null}
											{$LL.formatCurrency(customItem.price * customItem.quantity)}
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
			</section>
		{/each}
	{:else}
		<p>No notes found for {date}.</p>
	{/if}
</div>

<style>
	.printable-daily-summary {
		font-family: Arial, sans-serif;
		margin: 20px;
		color: #000;
	}
	header {
		margin-bottom: 20px;
		padding-bottom: 10px;
		border-bottom: 1px solid #ccc;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h1 {
		font-size: 24px;
		margin: 0;
	}
	h2 {
		font-size: 20px;
		margin-top: 0;
		margin-bottom: 5px;
		padding-top: 15px; /* Space above each note title */
		border-top: 1px dashed #eee; /* Separator for notes */
	}
	.note-section:first-child h2 {
		border-top: none; /* No top border for the very first note */
		padding-top: 0;
	}
	.note-section {
		margin-bottom: 30px; /* Space between note sections */
		page-break-inside: avoid; /* Try to keep each note section on one page */
	}
	p {
		font-size: 14px;
		margin-bottom: 5px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 15px;
	}
	th, td {
		border: 1px solid #ddd;
		padding: 8px;
		text-align: left;
		font-size: 12px;
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
			font-size: 10pt; /* Smaller base font for print */
			margin: 0;
			padding: 0;
			background-color: #fff;
			color: #000;
		}
		.printable-daily-summary {
			margin: 10mm;
		}
		.no-print, .print-button { /* Hide elements not for printing */
			display: none !important;
		}
		header { /* Print-specific header styling if any was needed, but it's hidden */
			border-bottom: 1px solid #000;
		}
		h1 {
			font-size: 20pt; /* Adjust title size for print */
		}
		h2 {
			font-size: 16pt; /* Adjust section title size */
			border-top: 1px solid #ccc; /* Lighter separator in print */
		}
		table, th, td {
			border: 1px solid #000;
			font-size: 9pt; /* Smaller table font for print */
		}
		th {
			background-color: #eee;
		}
		.note-section {
			page-break-before: auto; /* Allow page breaks before sections if needed */
			page-break-inside: avoid; /* Still try to avoid breaking a section */
		}
		/* Ensure links (if any accidentally included) are printed clearly */
		a {
			color: #000 !important;
			text-decoration: none !important;
		}
	}
</style>
