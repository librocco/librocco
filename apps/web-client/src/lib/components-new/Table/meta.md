---
name: Table
description: Generic Svelte table primitives (`Table` and `TableRow`) with slot-based rendering and optional empty state.
usage: "generic"
---

## Overview

`Table` and `TableRow` are low-level Svelte UI primitives for rendering tabular data with semantic HTML and predictable styling.

- Parent owns all data and row state.
- Content is passed through slots.
- The component does not implement sorting, pagination, filtering, or selection logic.

## Imports

```ts
import Table from "$lib/components-new/Table/Table.svelte";
import TableRow from "$lib/components-new/Table/TableRow.svelte";
```

## Table API

### Props

| Prop             | Type                                                              | Default     | Notes                                        |
| ---------------- | ----------------------------------------------------------------- | ----------- | -------------------------------------------- |
| `variant`        | `"default" \| "naked"`                                            | `"default"` | Visual style only.                           |
| `columnWidths`   | `Array<string \| { value: number; unit?: "%" \| "px" \| "rem" }>` | `[]`        | Controls generated `<colgroup>`.             |
| `showEmptyState` | `boolean`                                                         | `false`     | Renders `empty` slot instead of `rows` slot. |

### Slots

- `head-cells`: header `<th>` elements.
- `rows`: body rows (usually `<TableRow>` instances).
- `empty`: optional empty-state content when `showEmptyState={true}`.

### Column width behavior

- String values are treated as 12-column fractions (`"3"` => `calc(3 / 12 * 100%)`).
- Object values are rendered as explicit widths (`{ value: 200, unit: "px" }`).
- Unsupported string tokens (for example `"flex"`) are not handled and should not be used.

## TableRow API

### Props

| Prop        | Type                   | Default     | Notes                                   |
| ----------- | ---------------------- | ----------- | --------------------------------------- |
| `variant`   | `"default" \| "naked"` | `"default"` | Matches table style.                    |
| `selected`  | `boolean`              | `false`     | Only affects `default` variant styling. |
| `className` | `string`               | `""`        | Extra classes appended to `<tr>`.       |

### Slot

- default slot: row cells (`<td>` elements).

## Svelte usage

```svelte
<script lang="ts">
  import Table from "$lib/components-new/Table/Table.svelte";
  import TableRow from "$lib/components-new/Table/TableRow.svelte";

  const rows = [{ id: "#1", supplier: "BooksRUs", placed: "11/10/2025, 2:15 PM" }];
</script>

<Table columnWidths={["3", "5", "4"]}>
  <svelte:fragment slot="head-cells">
    <th scope="col" class="text-muted-foreground px-4 py-3 text-xs">Order ID</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-xs">Supplier</th>
    <th scope="col" class="text-muted-foreground px-4 py-3 text-xs">Placed</th>
  </svelte:fragment>

  <svelte:fragment slot="rows">
    {#each rows as row (row.id)}
      <TableRow>
        <td class="px-4 py-2 text-sm">{row.id}</td>
        <td class="px-4 py-2 text-sm">{row.supplier}</td>
        <td class="px-4 py-2 text-sm">{row.placed}</td>
      </TableRow>
    {/each}
  </svelte:fragment>
</Table>
```

## Accessibility notes

- Keep semantic structure (`<th scope="col">`, `<td>`, one header row).
- Keep column counts aligned between header and body rows.
- For icon-only headers/cells, provide accessible text (e.g. `sr-only`).
