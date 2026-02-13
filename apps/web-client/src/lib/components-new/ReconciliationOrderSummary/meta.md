---
name: ReconciliationOrderSummary
description: Expandable order summary card for reconciliation flow, showing book details and action options for missing books
usage: generic
---

The ReconciliationOrderSummary component displays customer order details during the delivery reconciliation process. It shows a summary header with customer name, order ID, and undelivered count badge, which expands to reveal the full order details.

## Features

- **Expandable/collapsible** using MeltUI's Collapsible builder
- **Slot-based action selection** for handling missing books (pending delivery vs queue)
- **Status badges**: Visual indicators for missing items and completed orders
- **Push-based expansion**: Content pushes surrounding elements down when opened (no overlay)
- **View-only mode**: Can be set to non-interactive for read-only displays

## Props

| Prop               | Type      | Required | Default | Description                               |
| ------------------ | --------- | -------- | ------- | ----------------------------------------- |
| `orderId`          | `string`  | Yes      | -       | Order identifier (e.g., "Order #1")       |
| `customerName`     | `string`  | Yes      | -       | Customer or supplier name                 |
| `undeliveredCount` | `number`  | Yes      | -       | Number of books not yet delivered         |
| `books`            | `Book[]`  | Yes      | -       | Array of book objects                     |
| `expanded`         | `boolean` | No       | `false` | Initial open/closed state                 |
| `interactive`      | `boolean` | No       | `true`  | Whether expand/collapse toggle is enabled |

## Book Type

```typescript
type Book = {
  isbn: string;
  title: string;
  authors: string;
  orderedQuantity: number;
  deliveredQuantity: number;
};
```

## Slots

- `underdelivery_behaviour` - Content for underdelivery action selection (typically `UnderdeliveryRadioGroup` or `UnderdeliveryActionBadge`)

## Usage Examples

### Basic Usage

```svelte
<script lang="ts">
  import { ReconciliationOrderSummary } from "$lib/components-new";

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

<ReconciliationOrderSummary orderId="Order #1" customerName="BooksRUS" :undeliveredCount="4" :books="books">
  <svelte:fragment slot="underdelivery_behaviour">
    <!-- UnderdeliveryRadioGroup component -->
  </svelte:fragment>
</ReconciliationOrderSummary>
```

### With Initial Expanded State

```svelte
<ReconciliationOrderSummary orderId="Order #2" customerName="Academic Press" :undeliveredCount="6" :books="booksArray" expanded={true} />
```

### Multiple Orders

```svelte
<div class="space-y-4">
  {#each orders as order}
    <ReconciliationOrderSummary
      orderId={order.id}
      customerName={order.customer}
      :undeliveredCount={order.undelivered}
      :books={order.books}
    />
  {/each}
</div>
```

## Behavior

### Header State

The header displays different badges depending on the order state:

- **Orange badge** - Shows "X books undelivered" when some books are missing
- **Green badge** - Shows "Complete" when all books are delivered
- Clicking the header (or chevron button) expands/collapses the content

### Book List

Shows a table with columns for ISBN, Title, Authors, Ordered Quantity, Delivered Quantity, and Status. The table uses the "naked" variant for minimal styling to integrate with the component's design.

### Status Indicators

Each book shows a status badge:

- **Orange badge** - Shows "X missing" when delivered < ordered
- **Green badge** - Shows "Complete" when delivered === ordered

### Action Selection

Action selection for handling missing books is handled via the `underdelivery_behaviour` slot. This allows you to provide custom action components like `UnderdeliveryRadioGroup` for interactive selections or `UnderdeliveryActionBadge` for read-only displays.

The slot content is only rendered when there are books in the order. Typical implementations include:

- **UnderdeliveryRadioGroup**: Interactive radio buttons to choose between "pending delivery" or "queue" actions, with a warning when selection deviates from supplier default
- **UnderdeliveryActionBadge**: Read-only display showing the selected action

This design provides flexibility in how actions are selected and displayed while keeping the ReconciliationOrderSummary component focused on displaying order details.

## Accessibility

- Uses MeltUI's Collapsible for proper ARIA attributes
- Keyboard navigable with Tab/Enter/Space
- Chevron icon rotates to indicate open/closed state
- Proper color contrast for badges
