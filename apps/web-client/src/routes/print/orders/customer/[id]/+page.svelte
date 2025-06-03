<script lang="ts">
	import type { PageData } from "./$types";
	import { onMount } from "svelte";
	import LL from "@librocco/shared/i18n-svelte"; // For currency formatting

	export let data: PageData;

	$: ({ customer, customerOrderLines } = data);

	let totalOrderAmount = 0;
	$: {
		if (customerOrderLines) {
			totalOrderAmount = customerOrderLines.reduce((sum, line) => {
				return sum + (line.price || 0) * (line.quantity || 0);
			}, 0);
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
	<title>Printable Customer Order - #{customer?.displayId || data.id}</title>
</svelte:head>

<div class="printable-customer-order">
	<header class="no-print">
		{#if customer}
			<h1>Printable Customer Order - #{customer.displayId}</h1>
		{:else}
			<h1>Printable Customer Order - ID: {data.id}</h1>
		{/if}
		<button on:click={triggerPrint} class="print-button">Print this page</button>
	</header>

	<div class="print-only-header">
		{#if customer}
			<h1>Printable Customer Order - #{customer.displayId}</h1>
		{:else}
			<h1>Printable Customer Order - ID: {data.id}</h1>
		{/if}
	</div>

	{#if customer}
		<section class="customer-details">
			<h2>Customer Information</h2>
			<p><strong>Order ID:</strong> #{customer.displayId}</p>
			<p><strong>Name:</strong> {customer.firstName || ''} {customer.lastName || ''}</p>
			<p><strong>Email:</strong> {customer.email || 'N/A'}</p>
			<p><strong>Phone:</strong> {customer.phone || 'N/A'}</p>
			{#if customer.depositAmount != null && customer.depositAmount > 0}
				<p><strong>Deposit Paid:</strong> {$LL.formatCurrency(customer.depositAmount)}</p>
			{/if}
		</section>

		{#if customerOrderLines && customerOrderLines.length > 0}
			<section class="order-lines">
				<h2>Order Items</h2>
				<table>
					<thead>
						<tr>
							<th>ISBN</th>
							<th>Title</th>
							<th>Authors</th>
							<th>Publisher</th>
							<th class="text-right">Quantity</th>
							<th class="text-right">Unit Price</th>
							<th class="text-right">Total Price</th>
						</tr>
					</thead>
					<tbody>
						{#each customerOrderLines as line}
							<tr>
								<td>{line.isbn}</td>
								<td>{line.title}</td>
								<td>{line.authors || 'N/A'}</td>
								<td>{line.publisherName || 'N/A'}</td>
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
				<p><strong>Total Order Amount:</strong> {$LL.formatCurrency(totalOrderAmount)}</p>
				{#if customer.depositAmount != null && customer.depositAmount > 0}
					<p><strong>Remaining Balance:</strong> {$LL.formatCurrency(totalOrderAmount - customer.depositAmount)}</p>
				{/if}
			</section>
		{:else}
			<p>No items found for this order.</p>
		{/if}
	{:else}
		<p>Loading customer order details...</p>
		<!-- Or handle error if customer is definitively not found -->
	{/if}
</div>

<style>
	.printable-customer-order {
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
	.customer-details p, .order-summary p {
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
		.printable-customer-order {
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
		/* Avoid page breaks inside customer details or order summary if possible */
		.customer-details, .order-summary, .order-lines {
			page-break-inside: avoid;
		}
		tr {
			page-break-inside: avoid; /* Try to keep rows from splitting */
		}
		a { /* Ensure links (if any accidentally included) are printed clearly */
			color: #000 !important;
			text-decoration: none !important;
		}
	}
</style>
