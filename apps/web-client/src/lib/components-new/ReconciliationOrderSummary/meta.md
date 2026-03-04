---
name: ReconciliationOrderSummary
description: Expandable order summary card for reconciliation flow, showing book details and action options for missing books
usage: generic
---

`ReconciliationOrderSummary` is a Svelte component used in supplier reconciliation to show one supplier order's line-level delivered vs ordered state.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | `""` | Display label, e.g. `Order #4`. |
| `customerName` | `string` | `""` | Display name in header (usually supplier). |
| `undeliveredCount` | `number` | `0` | Shown in header badge when not complete. |
| `books` | `ReconciliationProcessedLine[]` | `[]` | Reconciliation rows. |
| `expanded` | `boolean` | `false` | Initial open state; can be used with `bind:expanded`. |
| `interactive` | `boolean` | `true` | Disables collapse controls when `false`. |

## Expected book shape

The component reads at least:

```ts
type ReconciliationProcessedLine = {
  isbn: string;
  title: string;
  authors: string;
  orderedQuantity: number;
  deliveredQuantity: number;
};
```

## Slots

- `underdelivery_behaviour`: optional content shown below the table (for example `UnderdeliveryRadioGroup` in editable mode or `UnderdeliveryActionBadge` in finalized mode).

## Svelte usage

```svelte
<script lang="ts">
  import ReconciliationOrderSummary from "$lib/components-new/ReconciliationOrderSummary/ReconciliationOrderSummary.svelte";
  import UnderdeliveryRadioGroup from "$lib/components-new/ReconciliationOrderSummary/UnderdeliveryRadioGroup.svelte";

  const books = [
    {
      isbn: "123",
      title: "The Great Gatsby",
      authors: "F. Scott Fitzgerald",
      orderedQuantity: 5,
      deliveredQuantity: 1
    }
  ];
</script>

<ReconciliationOrderSummary orderId="Order #1" customerName="BooksRUS" undeliveredCount={4} books={books}>
  <svelte:fragment slot="underdelivery_behaviour">
    <UnderdeliveryRadioGroup supplierId={1} defaultValue="pending" />
  </svelte:fragment>
</ReconciliationOrderSummary>
```

## Behavior

- Uses Melt UI collapsible for expand/collapse.
- Header badge is orange when any line is missing, green when all lines are complete.
- Table rows compute `missing = orderedQuantity - deliveredQuantity` per line.
- Slot content renders only when there are books.
- Component is presentational and does not dispatch custom events.

## Notes

- Use Svelte prop syntax (`books={books}`), not Vue-style `:books="books"`.
- Table header currently uses the same i18n key for both quantity columns; labels are still derived from runtime i18n config.
