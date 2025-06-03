<script lang="ts">
	import type { PageData } from "./$types";
	import { onMount } from "svelte";
	import LL from "@librocco/shared/i18n-svelte"; // For currency formatting
	import { generateUpdatedAtString } from "$lib/utils/time"; // For date formatting

	export let data: PageData;

	$: ({ order, orderLines } = data);

	let totalOrderValue = 0;
	let totalQuantity = 0;
	let totalUniqueItems = 0;

	$: {
		if (orderLines) {
			totalOrderValue = orderLines.reduce((sum, line) => {
				return sum + (line.price || 0) * (line.quantity || 0);
			}, 0);
			totalQuantity = orderLines.reduce((sum, line) => {
				return sum + (line.quantity || 0);
			}, 0);
			totalUniqueItems = orderLines.length;
		}
	}

	onMount(() => {
		// Optional: Automatically trigger print dialog when page loads
		// window.print();
	});

	function triggerPrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Printable Supplier Order - #{order?.reference || data.id}</title>
</svelte:head>

<div class="printable-supplier-order">
	<header class="no-print">
		{#if order}
			<h1>Printable Supplier Order - #{order.reference || `ID ${order.id}`}</h1>
		{:else}
			<h1>Printable Supplier Order - ID: {data.id}</h1>
		{/if}
		<button on:click={triggerPrint} class="print-button">Print this page</button>
	</header>

	<div class="print-only-header">
		{#if order}
			<h1>Printable Supplier Order - #{order.reference || `ID ${order.id}`}</h1>
		{:else}
			<h1>Printable Supplier Order - ID: {data.id}</h1>
		{/if}
	</div>

	{#if order}
		<section class="order-details">
			<h2>Order Information</h2>
			<p><strong>Order ID:</strong> {order.id}</p>
			{#if order.reference}
				<p><strong>Reference:</strong> {order.reference}</p>
			{/if}
			<p><strong>Supplier:</strong> {order.supplierName || 'N/A'}</p>
			<p><strong>Order Date:</strong> {generateUpdatedAtString(order.createdAt)}</p>
			{#if order.expectedAt}
				<p><strong>Expected Date:</strong> {generateUpdatedAtString(order.expectedAt)}</p>
			{/if}
		</section>

		{#if orderLines && orderLines.length > 0}
			<section class="order-lines-table">
				<h2>Order Items</h2>
				<table>
					<thead>
						<tr>
							<th>ISBN</th>
							<th>Title</th>
							<th>Authors</th>
							<th class="text-right">Quantity</th>
							<th class="text-right">Unit Price</th>
							<th class="text-right">Total Price</th>
						</tr>
					</thead>
					<tbody>
						{#each orderLines as line}
							<tr>
								<td>{line.isbn}</td>
								<td>{line.title || 'N/A'}</td>
								<td>{line.authors || 'N/A'}</td>
								<td class="text-right">{line.quantity}</td>
								<td class="text-right">
									{#if line.price != null}
										{$LL.formatCurrency(line.price)}
									{:else}
										N/A
									{/if}
								</td>
								<td class="text-right">
									{#if line.price != null && line.quantity != null}
										{$LL.formatCurrency(line.price * line.quantity)}
									{:else}
										N/A
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>

			<section class="order-summary">
				<h2>Order Summary</h2>
				<p><strong>Total Unique Items:</strong> {totalUniqueItems}</p>
				<p><strong>Total Quantity of Books:</strong> {totalQuantity}</p>
				<p><strong>Total Order Value:</strong> {$LL.formatCurrency(totalOrderValue)}</p>
			</section>
		{:else}
			<p>No items found for this supplier order.</p>
		{/if}
	{:else}
		<p>Loading supplier order details...</p>
		<!-- Or handle error if order is definitively not found -->
	{/if}
</div>

<style>
	.printable-supplier-order {
		font-family: Arial, sans-serif;
		margin: 20px;
		color: #000;
	}
	header.no-print {
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
		font-size: 18px;
		margin-top: 20px;
		margin-bottom: 10px;
		border-bottom: 1px solid #eee;
		padding-bottom: 5px;
	}
	.order-details p, .order-summary p {
		font-size: 14px;
		margin-bottom: 5px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 10px;
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
			font-size: 10pt;
			margin: 0;
			padding: 0;
			background-color: #fff;
			color: #000;
		}
		.printable-supplier-order {
			margin: 10mm;
		}
		.no-print, .print-button {
			display: none !important;
		}
		.print-only-header {
			display: none; /* Hidden by default */
		}

		@media print {
			/* ... other print styles ... */
			.print-only-header {
				display: block; /* Visible only in print */
				text-align: center; /* Optional: center the title */
				margin-bottom: 20px; /* Space below the title */
			}
			.print-only-header h1 {
				font-size: 20pt; /* Consistent H1 size */
				margin: 0;
			}
			/* Ensure original h1 within no-print header is truly gone if not already by .no-print */
			header.no-print h1 {
				display: none !important;
			}
			h2 {
			font-size: 14pt;
			border-bottom: 1px solid #000;
		}
		table, th, td {
			border: 1px solid #000;
			font-size: 9pt;
		}
		th {
			background-color: #eee;
		}
		.order-details, .order-summary, .order-lines-table {
			page-break-inside: avoid;
		}
		tr {
			page-break-inside: avoid;
		}
		a {
			color: #000 !important;
			text-decoration: none !important;
		}
	}
</style>
