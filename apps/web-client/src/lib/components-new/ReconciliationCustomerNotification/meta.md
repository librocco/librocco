---
name: ReconciliationCustomerNotification
description: Expandable notification component showing which customers will be notified for delivered books, grouped by book with customer details
usage: generic
---

`ReconciliationCustomerNotification` is a presentational Svelte component used in reconciliation step 2 to preview or display customer notifications grouped by ISBN.

## Props

| Prop          | Type               | Default | Notes                                                               |
| ------------- | ------------------ | ------- | ------------------------------------------------------------------- |
| `finalized`   | `boolean`          | `false` | Switches message text between pending/finalized variants from i18n. |
| `books`       | `DeliveryByISBN[]` | `[]`    | Grouped notification payload.                                       |
| `expanded`    | `boolean`          | `false` | Initial open state. Can also be bound with `bind:expanded`.         |
| `interactive` | `boolean`          | `true`  | Disables collapsible behavior and chevron when `false`.             |

## Data shape

The component expects `DeliveryByISBN` from `apps/web-client/src/lib/db/cr-sqlite/types.ts`:

```ts
type DeliveryByISBN = {
  isbn: string;
  title: string;
  total: number;
  customers: {
    customer_name: string;
    customer_display_id: string;
    created: Date;
  }[];
};
```

## Svelte usage

```svelte
<script lang="ts">
  import ReconciliationCustomerNotification from "$lib/components-new/ReconciliationCustomerNotification/ReconciliationCustomerNotification.svelte";

  let expanded = false;
  const books = [
    {
      isbn: "123",
      title: "The Great Gatsby",
      total: 2,
      customers: [{ customer_name: "Sarah Johnson", customer_display_id: "1", created: new Date("2024-12-15T10:30:00") }]
    }
  ];
</script>

<ReconciliationCustomerNotification {books} bind:expanded />
```

## Behavior

- Uses Melt UI `createCollapsible` for expand/collapse state.
- Header always renders; details render only when `books.length > 0`.
- Copy label uses i18n pluralization based on `book.customers.length`.
- Customer order date is formatted with shared i18n date/time formatters.
- Component is display-only; it does not emit custom events.

## Notes

- This is Svelte syntax only (`books={books}`), not Vue-style `:books="books"` bindings.
- `total` is part of the input shape, but display copy count comes from `customers.length`.
