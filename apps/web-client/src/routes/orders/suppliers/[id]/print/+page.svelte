<script lang="ts">
  import type { PageData } from "./$types";
  export let data: PageData;
  $: ({ supplier, orders } = data);
  const printDate = new Date().toLocaleDateString();
</script>

<header>
  <h1>Printable Supplier Order</h1>
  {#if supplier}
    <p class="print-subtitle">Supplier: {supplier.name} (#{supplier.id})</p>
  {/if}
  <p class="print-date">Printed on: {printDate}</p>
</header>

{#if supplier}
  <section class="supplier-details">
    <h2>Supplier Details</h2>
    <p><strong>Name:</strong> {supplier.name} (#{supplier.id})</p>
    <p><strong>Email:</strong> {supplier.email || 'N/A'}</p>
    <p><strong>Address:</strong> {supplier.address || 'N/A'}</p>
    <p><strong>Customer ID:</strong> {supplier.customerId || 'N/A'}</p>
  </section>
{/if}

{#if orders && orders.length}
  <section class="orders-list">
    <h2>Orders</h2>
    {#each orders as order (order.id)}
      <div class="order-item">
        <h3>Order ID: {order.id} (Created: {new Date(order.createdAt).toLocaleDateString()})</h3>
        <p><strong>Status:</strong> {order.reconciled ? 'Reconciled' : 'Unreconciled'}</p>
        {#if order.lines && order.lines.length}
          <table>
            <thead>
              <tr>
                <th>ISBN</th>
                <th>Title</th>
                <th>Quantity</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {#each order.lines as line}
                <tr>
                  <td>{line.isbn}</td>
                  <td>{line.title || 'N/A'}</td>
                  <td>{line.quantity}</td>
                  <td>€{line.price?.toFixed(2) || 'N/A'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p>No lines in this order.</p>
        {/if}
      </div>
    {/each}
  </section>
{:else}
  <p>No orders found for this supplier.</p>
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
  .supplier-details, .orders-list, .order-item {
    margin-bottom: 20px;
  }
  .supplier-details h2, .orders-list h2, .order-item h3 {
    font-size: 1.2em;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
  .order-item h3 {
    font-size: 1.1em;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
    margin-top: 10px;
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
    tr, .order-item, section { page-break-inside: avoid; }

    @page {
      @top-center {
        content: "Supplier Order - " var(--supplier-name, "N/A");
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
<div style={supplier ? `--supplier-name: '${supplier.name?.replace("'", "\'")} (#${supplier.id})';` : ''}></div>
<div class="print-date-footer">Printed on: {printDate}</div>
