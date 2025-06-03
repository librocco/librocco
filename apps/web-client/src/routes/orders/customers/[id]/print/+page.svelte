<script lang="ts">
  import type { PageData } from "./$types";
  export let data: PageData;
  $: ({ customer, customerOrderLines } = data);
  $: totalAmount = customerOrderLines?.reduce((acc, cur) => acc + cur.price, 0) || 0;
  const printDate = new Date().toLocaleDateString();
</script>

<header>
  <h1>Printable Customer Order</h1>
  {#if customer}
    <p class="print-subtitle">Order for: {customer.fullname} (#{customer.displayId})</p>
  {/if}
  <p class="print-date">Printed on: {printDate}</p>
</header>

{#if customer}
  <section class="customer-details">
    <h2>Customer Details</h2>
    <p><strong>Name:</strong> {customer.fullname} (#{customer.displayId})</p>
    <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
    <p><strong>Phone:</strong> {customer.phone || 'N/A'}</p>
    <p><strong>Deposit:</strong> €{customer.deposit || 0}</p>
    <p><strong>Total Amount:</strong> €{totalAmount.toFixed(2)}</p>
  </section>
{/if}

{#if customerOrderLines && customerOrderLines.length}
  <section class="order-lines">
    <h2>Order Lines</h2>
    <table>
      <thead>
        <tr>
          <th>ISBN</th>
          <th>Title</th>
          <th>Authors</th>
          <th>Price</th>
          <th>Publisher</th>
          <th>Status</th>
          <th>Collected</th>
        </tr>
      </thead>
      <tbody>
        {#each customerOrderLines as line}
          <tr>
            <td>{line.isbn}</td>
            <td>{line.title || 'N/A'}</td>
            <td>{line.authors || 'N/A'}</td>
            <td>€{line.price.toFixed(2)}</td>
            <td>{line.publisher || 'N/A'}</td>
            <td>{line.status}</td>
            <td>{line.collected ? new Date(line.collected).toLocaleDateString() : 'No'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{:else}
  <p>No order lines found for this customer.</p>
{/if}

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
  .print-subtitle, .print-date {
    font-size: 0.9em;
    color: #555;
  }
  .customer-details, .order-lines {
    margin-bottom: 20px;
  }
  .customer-details h2, .order-lines h2 {
    font-size: 1.2em;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
  }
  th, td {
    border: 1px solid black;
    padding: 6px;
    text-align: left;
  }
  th {
    background-color: #f0f0f0;
  }
  p {
    font-size: 0.9em;
    margin: 5px 0;
  }

  @media print {
    :global(body) {
      margin: 15mm;
    }
    header { display: none; }
    thead { display: table-header-group; }
    tr, section { page-break-inside: avoid; }

    @page {
      @top-center {
        content: "Customer Order - " var(--customer-name, "N/A"); /* Use CSS variable if possible */
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
<!-- Set CSS variable for customer name if customer exists -->
<div style={customer ? `--customer-name: '${customer.fullname?.replace("'", "\'")} (#${customer.displayId})';` : ''}></div>
<div class="print-date-footer">Printed on: {printDate}</div>
