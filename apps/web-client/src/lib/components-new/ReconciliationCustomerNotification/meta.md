---
name: ReconciliationCustomerNotification
description: Expandable notification component showing which customers will be notified for delivered books, grouped by book with customer details
usage: generic
---

The ReconciliationCustomerNotification component displays a notification about customers who will be informed when their ordered books are delivered and ready for collection. It provides a summary message in the header that expands to show detailed customer information grouped by book.

## Features

- **Expandable/collapsible** using MeltUI's Collapsible builder
- **Book-based grouping**: Customers organized by ISBN and title with copy count badges
- **Customer details**: Shows customer name, ID, and order date for each book
- **View-only mode**: Can be set to non-interactive for read-only displays
- **Gray background**: Distinctive styling with neutral-50 background color

## Props

| Prop          | Type      | Required | Default | Description                                                           |
| ------------- | --------- | -------- | ------- | --------------------------------------------------------------------- |
| `finalized`   | `boolean` | No       | `false` | Whether the notification is in finalized state (affects message text) |
| `books`       | `Book[]`  | Yes      | -       | Array of book objects with customer mappings                          |
| `expanded`    | `boolean` | No       | `false` | Initial open/closed state                                             |
| `interactive` | `boolean` | No       | `true`  | Whether expand/collapse toggle is enabled                             |

## Book Type

```typescript
type Book = {
  isbn: string;
  title: string;
  total: number;
  customers: Customer[];
};
```

## Customer Type

```typescript
type Customer = {
  fullname: string;
  customer_display_id: string;
  created: string;
};
```

## Usage Examples

### Basic Usage

```svelte
<script lang="ts">
  import { ReconciliationCustomerNotification } from "$lib/components-new";

  const books = [
    {
      isbn: "123",
      title: "The Great Gatsby",
      total: 2,
      customers: [
        { fullname: "Sarah Johnson", customer_display_id: "C001", created: "Dec 15, 10:30 AM" },
        { fullname: "Michael Chen", customer_display_id: "C002", created: "Dec 16, 02:20 PM" }
      ]
    }
  ];
</script>

<ReconciliationCustomerNotification :books="books" />
```

### Finalized State (Read-Only Mode)

```svelte
<ReconciliationCustomerNotification :books="books" finalized={true} expanded={true} interactive={false} />
```

### Expanded by Default

```svelte
<ReconciliationCustomerNotification :books="books" expanded={true} />
```

### View-Only Mode (Non-Interactive)

```svelte
<ReconciliationCustomerNotification :books="books" finalized={true} expanded={true} interactive={false} />
```

### Multiple Notifications

```svelte
<div class="space-y-4">
  <ReconciliationCustomerNotification :books="deliveredBooks" />
  <ReconciliationCustomerNotification :books="receiptBooks" expanded={true} />
</div>
```

## Behavior

### Expandable Header

The header displays:

- **Bell icon**: Visual indicator for notification
- **Message text**: Auto-generated notification message based on `finalized` prop:
  - When `finalized={false}`: "Customers will be notified that delivered books are ready for collection"
  - When `finalized={true}`: "These customers were notified that delivered books are ready for collection"
- **Chevron arrow**: Expands/collapses the content (rotates 180° when open)

When interactive:

- Header is clickable to toggle expand/collapse
- Chevron button is clickable (stops propagation to avoid double-toggle)
- Hover effect on header (`hover:bg-neutral-100`)

### Book Pills

Each book section displays:

- **ISBN**: Book ISBN number
- **Title**: Book title
- **Copy count**: "(1 copy)" or "(X copies)" showing total customer count
- Styled as: `inline-flex`, `bg-neutral-200`, `rounded`, `text-xs`, `font-medium`

### Customer Tables

For each book, a table shows:

- **Header row**: "Customer", "ID", "Order Date" column labels
  - Uppercase, text-xs, tracking-wide, muted-foreground color
- **Customer rows**: Name, ID, and order date for each customer
  - Text-sm, appropriate foreground colors
  - Border-bottom between rows (except last customer)

### Empty State

When `books` array is empty:

- Header still displays with message
- No book/customer content shown
- Component is not hidden

### Copy Count Logic

The component automatically displays the correct copy label:

- 1 customer → "(1 copy)"
- 2+ customers → "(X copies)"

This is calculated based on the `customers.length` for each book.

## Styling

### Key Style Differences

Compared to ReconciliationOrderSummary:

- **Gray background**: `bg-neutral-50` instead of white/card background
- **Bell icon**: Always visible in header (lucide-bell)
- **No status badges**: Doesn't show undelivered/complete badges
- **No action slots**: Does not support underdelivery behavior actions
- **Book pills**: Unique badge style showing ISBN, title, and copy count

### Color Scheme

- Background: `bg-neutral-50` (gray)
- Border: `border-neutral-200`
- Header hover: `hover:bg-neutral-100`
- Text: `text-foreground`, `text-muted-foreground`
- Book pills: `bg-neutral-200`

### Typography

- Message text: `text-sm`, `text-foreground`
- Column headers: `text-xs`, `uppercase`, `tracking-[0.3px]`, `text-muted-foreground`
- Customer names: `text-sm`, `text-foreground`
- Customer data: `text-sm`, `text-muted-foreground`

### Fixed Widths (Desktop-Only)

- ID column: `w-32` (128px)
- Order Date column: `w-44` (176px)
- Customer column: `flex-1` (takes remaining space)

Note: Per requirements, this component is desktop-only with no responsive design.

## Accessibility

- **MeltUI Collapsible**: Provides proper ARIA attributes for expanded/collapsed state
- **Keyboard navigation**: Header can be focused and toggled with Tab/Enter/Space
- **Icon semantics**: Bell and chevron icons have `aria-hidden="true"`
- **Color contrast**: Follows design system color variables for proper contrast
- **Focus indicators**: Interactive elements have focus states through browser defaults

## Design System Integration

This component uses CSS variables consistent with the Librocco design system:

- `--neutral-50`, `--neutral-200` for backgrounds and borders
- `--foreground`, `--muted-foreground` for text colors
- `--radius` for rounding
- `--text-xs`, `--text-sm` for font sizes
- `--font-inter` for the Inter font family
- `--font-weight-normal`, `--font-weight-medium` for font weights

## Use Cases

1. **Reconciliation review step**: Show which customers will be notified during delivery reconciliation
2. **View-only confirmation**: Display notification history in read-only mode
3. **Dashboard overview**: Show notification summaries in admin dashboards
4. **Multi-notification display**: Group different types of notifications (e.g., delivered books vs digital receipts)

## Notes

- This is a **display-only** component with no data modification capabilities
- Unlike ReconciliationOrderSummary, it does not support action selection or status tracking
- The component does not dispatch any events - it's purely presentational
- Copy count is calculated dynamically based on customer array length
- Books are displayed in the order provided (no automatic sorting)
