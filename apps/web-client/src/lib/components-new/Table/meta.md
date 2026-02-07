---
name: Table
description: A generic, unopinionated table component with proper HTML semantics. Use for tabular data display with full control over content, styling, and behavior through slots. Supports fixed column widths via colgroup for consistent layout.
usage: "generic"
---

## Overview

The `Table` component provides a semantically correct HTML table structure with consistent styling while remaining completely unopinionated about data handling and state management. All content is provided via slots, giving parents full control over rendering.

## Import

```ts
import { Table, TableRow } from "$lib/components-new/Table";
```

## Basic Usage

### Simple Table

```svelte
<script>
  const users = [
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
    { id: 3, name: "Charlie", email: "charlie@example.com" }
  ];
</script>

<Table>
  <svelte:fragment slot="head-cells">
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Name</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Email</th>
  </svelte:fragment>

  <svelte:fragment slot="rows">
    {#each users as user}
      <TableRow>
        <td class="px-[16px] py-[8px] text-[14px]">{user.name}</td>
        <td class="px-[16px] py-[8px] text-[14px]">{user.email}</td>
      </TableRow>
    {/each}
  </svelte:fragment>
</Table>
```

### Table with Column Widths

Use `columnWidths` prop to define column proportions. Supports:

- **Grid fractions**: `"1"`, `"2"`, `"3"` (out of 12) - converted to percentages
- **Explicit units**: `{ value: 200, unit: 'px' }`, `{ value: '20%', unit: '%' }`

```svelte
<script>
  const orders = [
    { id: "#1", supplier: "BooksRUs", date: "11/10/2025, 2:15 PM", status: "Pending" },
    { id: "#2", supplier: "NovelSupply Co.", date: "11/08/2025, 9:30 AM", status: "Shipped" }
  ];
</script>

<Table columnWidths={["2", "3", "4", "3"]}>
  <svelte:fragment slot="head-cells">
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Order ID</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Supplier</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Date</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Status</th>
  </svelte:fragment>

  <svelte:fragment slot="rows">
    {#each orders as order}
      <TableRow>
        <td class="px-[16px] py-[8px] text-[14px] font-medium">{order.id}</td>
        <td class="px-[16px] py-[8px] text-[14px]">{order.supplier}</td>
        <td class="px-[16px] py-[8px] text-[14px]">{order.date}</td>
        <td class="px-[16px] py-[8px] text-[14px]">
          <span class="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {order.status}
          </span>
        </td>
      </TableRow>
    {/each}
  </svelte:fragment>
</Table>
```

### Table with Selection

Parent controls selection state, checkbox provided as cell content:

```svelte
<script>
  let selectedIds = new Set();

  function toggleSelection(id) {
    if (selectedIds.has(id)) {
      selectedIds = new Set([...selectedIds].filter((x) => x !== id));
    } else {
      selectedIds = new Set([...selectedIds, id]);
    }
  }

  const items = [
    { id: 1, name: "Item 1", category: "Books" },
    { id: 2, name: "Item 2", category: "Electronics" }
  ];
</script>

<Table columnWidths={["1", "3", "4", "4"]}>
  <svelte:fragment slot="head-cells">
    <th scope="col" class="px-4 py-3">
      <span class="sr-only">Select</span>
    </th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">ID</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Name</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Category</th>
  </svelte:fragment>

  <svelte:fragment slot="rows">
    {#each items as item}
      <TableRow selected={selectedIds.has(item.id)}>
        <td class="px-[16px] py-[8px] text-center">
          <input type="checkbox" checked={selectedIds.has(item.id)} on:change={() => toggleSelection(item.id)} />
        </td>
        <td class="px-[16px] py-[8px] text-[14px]">{item.id}</td>
        <td class="px-[16px] py-[8px] text-[14px] font-medium">{item.name}</td>
        <td class="px-[16px] py-[8px] text-[14px]">{item.category}</td>
      </TableRow>
    {/each}
  </svelte:fragment>
</Table>
```

### Table with Empty State

Use `showEmptyState` prop to display an empty state instead of rows:

```svelte
<script>
  let showEmpty = false;
  const orders = [{ id: "#1", supplier: "BooksRUs", date: "11/10/2025, 2:15 PM", status: "Pending" }];
</script>

<Table columnWidths={["2", "3", "4", "3"]} showEmptyState={showEmpty}>
  <svelte:fragment slot="head-cells">
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Order ID</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Supplier</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Date</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Status</th>
  </svelte:fragment>

  <svelte:fragment slot="empty">
    <div class="flex flex-col items-center gap-2">
      <span class="text-muted-foreground">No orders found</span>
      <button class="btn-primary btn-sm btn">Create your first order</button>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="rows">
    {#each orders as order}
      <TableRow>
        <td class="px-[16px] py-[8px] text-[14px] font-medium">{order.id}</td>
        <td class="px-[16px] py-[8px] text-[14px]">{order.supplier}</td>
        <td class="px-[16px] py-[8px] text-[14px]">{order.date}</td>
        <td class="px-[16px] py-[8px] text-[14px]">
          <span class="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {order.status}
          </span>
        </td>
      </TableRow>
    {/each}
  </svelte:fragment>
</Table>
```

The table head remains visible when showing the empty state, and you can provide custom content via the `empty` slot (defaults to "Nothing to see here").

### Table with Actions and Badges

Full control over cell content allows complex elements:

```svelte
<script>
  const products = [
    { id: 101, title: "The Great Gatsby", author: "F. Scott Fitzgerald", stock: 15, price: 12.99 },
    { id: 102, title: "1984", author: "George Orwell", stock: 3, price: 9.99 }
  ];
</script>

<Table columnWidths={["2", "4", "3", "2", "1"]}>
  <svelte:fragment slot="head-cells">
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">ID</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Title</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Author</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Stock</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-[12px]">Price</th>
    <th scope="col" class="sr-only">Actions</th>
  </svelte:fragment>

  <svelte:fragment slot="rows">
    {#each products as product}
      <TableRow>
        <td class="px-[16px] py-[8px] text-[14px]">#{product.id}</td>
        <td class="px-[16px] py-[8px] text-[14px] font-medium">{product.title}</td>
        <td class="px-[16px] py-[8px] text-[14px]">{product.author}</td>
        <td class="px-[16px] py-[8px] text-[14px]">
          {#if product.stock < 5}
            <span class="badge-warning badge rounded-full px-2 py-1 text-xs">Low Stock</span>
          {:else}
            <span class="badge-success badge rounded-full px-2 py-1 text-xs">In Stock</span>
          {/if}
          <span class="ml-2">{product.stock}</span>
        </td>
        <td class="px-[16px] py-[8px] text-[14px]">€{product.price.toFixed(2)}</td>
        <td class="px-[16px] py-[8px] text-right">
          <button class="btn-primary btn-sm btn">Edit</button>
        </td>
      </TableRow>
    {/each}
  </svelte:fragment>
</Table>
```

### Table with Custom Padding (Opting Out)

To opt out of opinionated padding, provide custom classes on `<td>` or `<th>`:

```svelte
<Table>
  <svelte:fragment slot="head-cells">
    <th class="px-2 py-2 text-left">Column</th>
  </svelte:fragment>

  <svelte:fragment slot="rows">
    <TableRow>
      <td class="px-2 py-2">Custom padding</td>
    </TableRow>
  </svelte:fragment>
</Table>
```

### Naked Variant (Minimal Styling)

Use the `naked` variant for minimal styling when integrating with your own visual system or when you want full control over the table's appearance:

```svelte
<script>
  const books = [
    { isbn: "123", title: "The Great Gatsby", author: "F. Scott Fitzgerald", stock: 5 },
    { isbn: "321", title: "1984", author: "George Orwell", stock: 3 }
  ];
</script>

<Table variant="naked" columnWidths={[{ value: 120, unit: "px" }, { value: 200, unit: "px" }, "flex", { value: 80, unit: "px" }]}>
  <svelte:fragment slot="head-cells">
    <th scope="col" class="text-muted-foreground px-4 py-2 text-xs uppercase tracking-wide">ISBN</th>
    <th scope="col" class="text-muted-foreground px-4 py-2 text-xs uppercase tracking-wide">Title</th>
    <th scope="col" class="text-muted-foreground px-4 py-2 text-xs uppercase tracking-wide">Author</th>
    <th scope="col" class="text-muted-foreground px-4 py-2 text-xs uppercase tracking-wide">Stock</th>
  </svelte:fragment>

  <svelte:fragment slot="rows">
    {#each books as book (book.isbn)}
      <TableRow variant="naked">
        <td class="px-2 py-1.5 text-sm font-medium">{book.isbn}</td>
        <td class="px-2 py-1.5 text-sm">{book.title}</td>
        <td class="flex-1 truncate px-2 py-1.5 text-sm">{book.author}</td>
        <td class="px-2 py-1.5 text-sm">{book.stock}</td>
      </TableRow>
    {/each}
  </svelte:fragment>
</Table>
```

**Key differences from default variant:**

- No borders on the container or between rows
- No background color on the header row
- No hover effects on rows
- No selection state highlight
- More flexible integration with custom styling systems

```

## API Reference

### Table

**Props:**

- `variant?: 'default' | 'naked'` - Visual styling variant (default: `'default'`)
  - `default`: Bordered container, header with background, rows with borders and hover
  - `naked`: No borders, no backgrounds, no hover effects
- `columnWidths?: Array<string | { value: number; unit?: '%' | 'px' | 'rem' }>` - Optional column width definitions
- `showEmptyState?: boolean` - Show empty state instead of rows (default: `false`)

**Slots:**

- `head-cells` - Header row cells (`<th>` elements)
- `rows` - Body rows (parent provides `<TableRow>` components)
- `empty` - Empty state content (rendered when `showEmptyState={true}`, default: "Nothing to see here")

**Styling:**

- Wrapper (default): `overflow-hidden rounded border border-[#E5E5E5]`
- Wrapper (naked): `overflow-hidden`
- Table: `w-full table-fixed`
- Header row (default): `border-b border-[#E5E5E5] bg-[#FAFAFA] px-4`
- Header row (naked): `px-4`

### TableRow

**Props:**

- `variant?: 'default' | 'naked'` - Visual styling variant (default: `'default'`)
  - `default`: Row with border, hover effect, and selection background
  - `naked`: No border, no hover, no background (selection state ignored)
- `selected?: boolean` - Whether row is in selected state (adds `bg-[#FAFAFA]` styling in default variant)
- `className?: string` - Additional CSS classes to apply

**Slots:**

- `default` - Row cells (`<td>` elements)

**Styling:**

- Row (default): `border-b border-[#E5E5E5] px-[16px] py-[8px] transition-colors hover:bg-[#FAFAFA]`, last row: `last:border-b-0`
- Row (naked): `px-[16px] py-[8px]`

## Best Practices

1. **Accessibility**: Always use `scope="col"` on header cells and `sr-only` labels for icon-only cells
2. **Column consistency**: Ensure the same number of cells in every row and header
3. **Semantic HTML**: Use `<td>` for data cells, `<th>` for headers only (not in body rows)
4. **Cell padding**: The `px-[16px] py-[8px]` classes are opinionated on `<tr>`, apply custom padding to `<td>/<th>` to override
5. **Type safety**: The component is strictly unopinionated - handle type safety at the parent level

## Semantics

The component uses proper HTML table elements:

- `<table>` with `table-fixed` layout
- `<thead>`, `<tbody>` for structure
- `<th scope="col">` for column headers
- `<tr>` with `TableRow` component
- `<td>` for data cells

This ensures proper screen reader navigation and semantic meaning.
```
