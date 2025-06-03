<script lang="ts">
  import type { PageData } from "./$types";
  export let data: PageData;
  $: ({ note, entries, customItems } = data);
  const printDate = new Date().toLocaleDateString();
</script>

<header>
  <h1>Printable Open Outbound Note</h1>
  {#if note}
    <p class="print-subtitle">Note: {note.displayName} (#{note.id})</p>
  {/if}
  <p class="print-date">Printed on: {printDate}</p>
</header>

{#if note}
  <section class="note-details">
    <h2>Note Details</h2>
    <p><strong>Name:</strong> {note.displayName} (#{note.id})</p>
    <p><strong>Warehouse:</strong> {note.warehouseName || 'N/A'}</p>
    <p><strong>Created At:</strong> {new Date(note.createdAt).toLocaleString()}</p>
    <p><strong>Note Type:</strong> {note.noteType}</p>
  </section>

  {#if entries && entries.length}
    <section class="book-entries">
      <h3>Book Entries</h3>
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
          {#each entries as entry}
            <tr>
              <td>{entry.isbn}</td>
              <td>{entry.title || 'N/A'}</td>
              <td>{entry.quantity}</td>
              <td>€{entry.price?.toFixed(2) || 'N/A'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {:else}
    <p>No book entries in this note.</p>
  {/if}

  {#if customItems && customItems.length}
    <section class="custom-items">
      <h3>Custom Items</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Quantity</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {#each customItems as item}
            <tr>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>€{item.price?.toFixed(2) || 'N/A'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {:else}
    <p>No custom items in this note.</p>
  {/if}
{:else}
  <p>Note details not found or note is committed.</p>
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
  .note-details, .book-entries, .custom-items {
    margin-bottom: 20px;
  }
  .note-details h2, .book-entries h3, .custom-items h3 { /* Adjusted h2 to h3 for entries/items */
    font-size: 1.2em;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
    margin-bottom: 10px;
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
    tr, section { page-break-inside: avoid; }

    @page {
      @top-center {
        content: "Outbound Note - " var(--note-name, "N/A");
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
<div style={note ? `--note-name: '${note.displayName?.replace("'", "\'")} (#${note.id})';` : ''}></div>
<div class="print-date-footer">Printed on: {printDate}</div>
