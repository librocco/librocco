# Underdelivery Policy Feature

## Overview

The underdelivery policy feature allows bookstores to configure how missing books are handled when a supplier delivers fewer items than ordered. Each supplier can be configured with one of two policies:

- **Pending**: Underdelivered books are rejected and must be manually reordered
- **Queue**: Underdelivered books are automatically added to a continuation order

## Use Cases

### When to Use "Pending" Policy

When the supplier doesn't keep track of underdelivery (missing books). In this case the missing books should be ordered again.

### When to Use "Queue" Policy

When the supplier keeps track of underdelivery (missing books). In this case, the supplier is expected to send the missing books with a subsequent shipment, no need for re-ordering.

## Configuration

### Setting the Policy

1. Navigate to the Suppliers page
2. Click on a supplier to view details
3. Click "Edit details"
4. Select the underdelivery policy from the dropdown:
   - "pending" (default)
   - "queue"
5. Click "Save"

### Viewing the Policy

The underdelivery policy is displayed on:

- **Supplier Card**: Shows current policy with a History icon
- **Reconciliation Step 2**: Shows action badge for each supplier order

## Behavior

### Pending Policy

When a supplier with "pending" policy underdelivers:

1. Underdelivered customer order lines are rejected
2. `placed` timestamp is set to `NULL`
3. Lines return to **Pending** state
4. Books reappear in "Unordered" supplier orders view
5. Clerk must manually reorder the books

**Example:**

```
Ordered: 10 copies of "Book A"
Delivered: 7 copies
Underdelivered: 3 copies

Result:
- 7 customer order lines marked as "Received"
- 3 customer order lines rejected (placed = NULL)
- 3 copies appear in "Unordered" view for reordering
```

### Queue Policy

When a supplier with "queue" policy underdelivers:

1. A continuation order is automatically created
2. Underdelivered quantities are added to the continuation order
3. Continuation order is linked to the original order
4. Customer order lines remain in **Placed** state
5. Clerk can review and place the continuation order

**Example:**

```
Ordered: 10 copies of "Book A"
Delivered: 7 copies
Underdelivered: 3 copies

Result:
- 7 customer order lines marked as "Received"
- 3 customer order lines remain "Placed"
- Continuation order created with 3 copies of "Book A"
- Continuation order linked to original supplier order
```

## Database Schema

### Supplier Table

```sql
ALTER TABLE supplier ADD COLUMN underdelivery_policy INTEGER DEFAULT 0;
-- 0 = pending, 1 = queue
```

### Supplier Order Continuation Table

```sql
CREATE TABLE supplier_order_continuation (
  parent_order_id INTEGER NOT NULL,
  continuation_order_id INTEGER NOT NULL,
  PRIMARY KEY (parent_order_id, continuation_order_id),
  FOREIGN KEY (parent_order_id) REFERENCES supplier_order(id),
  FOREIGN KEY (continuation_order_id) REFERENCES supplier_order(id)
);
```

## API

### Type Definitions

```typescript
export type Supplier = {
  id?: number | null;
  name?: string;
  email?: string;
  address?: string;
  customerId?: number;
  orderFormat?: Format;
  underdelivery_policy?: 0 | 1; // 0 = pending, 1 = queue
};

export type PlacedSupplierOrder = {
  id: number;
  created: number;
  reconciliation_order_id: number | null;
  reconciliation_last_updated_at: number | null;
  finalized: number | null;
  parent_order_id: number | null; // Links to continuation parent
} & PossibleSupplierOrder;
```

### Database Functions

```typescript
// Get suppliers with underdelivery policy
async function _getAllSuppliers(db: TXAsync): Promise<SupplierExtended[]> {
  const query = `
    SELECT
      supplier.id,
      name,
      COALESCE(email, 'N/A') as email,
      COALESCE(address, 'N/A') as address,
      COALESCE(customerId, 'N/A') as customerId,
      orderFormat,
      COALESCE(underdelivery_policy, 0) as underdelivery_policy,
      COUNT(publisher) as numPublishers
    FROM supplier
    LEFT JOIN supplier_publisher ON supplier.id = supplier_publisher.supplier_id
    GROUP BY supplier.id
    ORDER BY supplier.id ASC
  `;
  return await db.execO<SupplierExtended>(query);
}

// Upsert supplier with underdelivery policy
async function _upsertSupplier(db: TXAsync, supplier: Supplier) {
  await db.exec(
    `INSERT INTO supplier (id, name, email, address, customerId, orderFormat, underdelivery_policy)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      address = COALESCE(?, address),
      customerId = COALESCE(?, customerId),
      orderFormat = COALESCE(?, orderFormat),
      underdelivery_policy = COALESCE(?, underdelivery_policy);`,
    [
      supplier.id,
      supplier.name,
      supplier.email,
      supplier.address,
      supplier.customerId ?? null,
      supplier.orderFormat ?? null,
      supplier.underdelivery_policy ?? 0
      // ... update values
    ]
  );
}
```

## UI Components

### SupplierCard

Displays the underdelivery policy with a History icon:

```svelte
<div class="flex items-start gap-3 py-1">
  <dt class="sr-only">Underdelivery policy</dt>
  <dd class="flex flex-1 items-start gap-3 text-sm">
    <History aria-hidden="true" class="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
    <span class="flex-1 justify-start">{policyLabel}</span>
  </dd>
</div>
```

### SupplierMetaForm

Dropdown to select underdelivery policy:

```svelte
<FormFieldProxy {form} let:errors let:errAttrs let:errAction name="underdeliveryPolicy">
  <label class="form-control w-full">
    <div class="label">Underdelivery policy</div>
    <select bind:value={$formStore.underdeliveryPolicy} class="select-bordered select w-full">
      <option value="pending">pending</option>
      <option value="queue">queue</option>
    </select>
  </label>
</FormFieldProxy>
```

### ReconcileStep2

Shows UnderdeliveryActionBadge for each supplier order:

```svelte
{#each orderStats as { supplier_order_id, supplier_name, underdelivery_policy, totalUnderdelivered, lines }}
  {@const underdeliveryAction = underdelivery_policy === 0 ? "pending" : "queue"}
  <ReconciliationOrderSummary ...>
    <UnderdeliveryActionBadge slot="underdelivery_behaviour" value={underdeliveryAction} />
  </ReconciliationOrderSummary>
{/each}
```

### UnderdeliveryActionBadge

Displays action based on policy:

```svelte
<script lang="ts">
  export let value: "pending" | "queue";
  let label = {
    pending: "Order marked as pending delivery",
    queue: "Missing books added to order queue"
  }[value];
</script>

<div class="p-4 pt-3">
  <p class="border-t border-neutral-200 pt-3">
    <span class="text-muted-foreground text-xs uppercase tracking-wide">ACTION:</span>
    <span class="rounded bg-neutral-100 px-2 py-1 text-xs text-zinc-900">{label}</span>
  </p>
</div>
```

## Internationalization

### English

```json
{
  "suppliers_page": {
    "card": {
      "underdelivery_policy": "Underdelivery policy"
    }
  },
  "forms": {
    "supplier_meta": {
      "labels": {
        "underdelivery_policy": "Underdelivery policy"
      }
    }
  }
}
```

### German

```json
{
  "suppliers_page": {
    "card": {
      "underdelivery_policy": ""
    }
  },
  "forms": {
    "supplier_meta": {
      "labels": {
        "underdelivery_policy": ""
      }
    }
  }
}
```

### Italian

```json
{
  "suppliers_page": {
    "card": {
      "underdelivery_policy": ""
    }
  },
  "forms": {
    "supplier_meta": {
      "labels": {
        "underdelivery_policy": ""
      }
    }
  }
}
```

## Testing

### Test Cases

1. **Pending Policy Test**

   - Create supplier with pending policy
   - Place supplier order
   - Reconcile with underdelivery
   - Verify underdelivered lines are rejected
   - Verify lines appear in unordered view

2. **Queue Policy Test**

   - Create supplier with queue policy
   - Place supplier order
   - Reconcile with underdelivery
   - Verify continuation order is created
   - Verify continuation order is linked to parent
   - Verify customer lines remain placed

3. **Policy Change Test**
   - Create supplier with pending policy
   - Place order
   - Change policy to queue
   - Reconcile with underdelivery
   - Verify queue policy is used

## Migration

### Database Migration

```sql
-- Add underdelivery_policy column to supplier table
ALTER TABLE supplier ADD COLUMN underdelivery_policy INTEGER DEFAULT 0;

-- Create supplier_order_continuation table
CREATE TABLE supplier_order_continuation (
  parent_order_id INTEGER NOT NULL,
  continuation_order_id INTEGER NOT NULL,
  PRIMARY KEY (parent_order_id, continuation_order_id),
  FOREIGN KEY (parent_order_id) REFERENCES supplier_order(id),
  FOREIGN KEY (continuation_order_id) REFERENCES supplier_order(id)
);
```

### Data Migration

No data migration needed - existing suppliers will use default policy (0 = pending).

## Future Enhancements

- [ ] Allow per-order policy override
- [ ] Add notification when continuation orders are created
- [ ] Show continuation order history in supplier details
- [ ] Add bulk policy update for multiple suppliers
- [ ] Add analytics on underdelivery by supplier
