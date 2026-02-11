---
name: ReconciliationOrderSummary
description: Expandable order summary card for reconciliation flow, showing book details and action options for missing books
usage: generic
---

The ReconciliationOrderSummary component displays customer order details during the delivery reconciliation process. It shows a summary header with customer name, order ID, and undelivered count badge, which expands to reveal the full order details.

## Features

- **Expandable/collapsible** using MeltUI's Collapsible builder
- **Responsive layout**: Table view on desktop, card view on mobile
- **Action selection** for handling missing books (pending delivery vs queue)
- **Status badges**: Visual indicators for missing items and completed orders
- **Push-based expansion**: Content pushes surrounding elements down when opened (no overlay)

## Props

| Prop               | Type      | Required | Default | Description                         |
| ------------------ | --------- | -------- | ------- | ----------------------------------- |
| `orderId`          | `string`  | Yes      | -       | Order identifier (e.g., "Order #1") |
| `customerName`     | `string`  | Yes      | -       | Customer or supplier name           |
| `undeliveredCount` | `number`  | Yes      | -       | Number of books not yet delivered   |
| `books`            | `Book[]`  | Yes      | -       | Array of book objects               |
| `expanded`         | `boolean` | No       | `false` | Initial open/closed state           |

## Book Type

```typescript
type Book = {
  isbn: string;
  title: string;
  author: string;
  ordered: number;
  delivered: number;
};
```

## Events

- `actionSelected` - Fired when user selects an action for missing books
  - Payload: `{ action: "pending" | "queue" }`
  - "pending" - Mark order as pending delivery
  - "queue" - Add missing books to order queue

## Usage Examples

### Basic Usage

```svelte
<script lang="ts">
  import { ReconciliationOrderSummary } from "$lib/components-new";

  const books = [
    {
      isbn: "123",
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      ordered: 5,
      delivered: 1
    }
  ];

  function handleAction(event) {
    console.log("Action selected:", event.detail.action);
  }
</script>

<ReconciliationOrderSummary
  orderId="Order #1"
  customerName="BooksRUS"
  :undeliveredCount="7"
  :books="books"
  on:actionSelected={handleAction}
/>
```

### With Initial expanded State

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
      on:actionSelected={(e) => handleAction(order.id, e.detail.action)}
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

- **Desktop**: Shows a table with columns for ISBN, Title, Author, Ordered, Delivered, and Status
- **Mobile**: Shows cards for each book with the same information stacked vertically

### Status Indicators

Each book shows a status badge:

- **Orange badge** - Shows "X missing" when delivered < ordered
- **Green badge** - Shows "Complete" when delivered === ordered

### Action Selection

When books are undelivered, two radio-style options appear:

1. **Mark order as pending delivery** - Action value: "pending"
2. **Add missing books to order queue** - Action value: "queue"

The action section is hidden when all books are delivered.

### Responsive Design

- Breakpoint: `md` (768px)
- Use Storybook's mobile viewport to test the mobile layout
- Mobile cards include vertical dividers (|) between ISBN, title, and author

## Accessibility

- Uses MeltUI's Collapsible for proper ARIA attributes
- Keyboard navigable with Tab/Enter/Space
- Chevron icon rotates to indicate open/closed state
- Proper color contrast for badges
