# Order Flow Documentation

## Overview & User Stories

Librocco's order flow manages the lifecycle of book orders from customer request to customer collection. The system handles three types of orders:

1. **Customer Orders** - Orders placed by customers with the bookshop
2. **Supplier Orders** - Orders placed by the bookshop with suppliers/publishers
3. **Reconciliation Orders** - Processing of received shipments from suppliers

### User Stories

#### US1: Customer Places an Order

A customer walks into the shop and requests books. The bookstore clerk creates a customer order and adds books to it. The system tracks each book as a separate order line in **Pending** state.

**Acceptance Criteria:**

- Customer information (name, email, phone, deposit) can be captured
- Multiple books can be added to a single customer order
- Each book is stored as an individual order line
- Order lines are automatically assigned a `created` timestamp

#### US2: Bookshop Orders from Suppliers

The bookstore clerk views all pending customer orders grouped by supplier (via publisher associations) and creates one or more supplier orders.

**Acceptance Criteria:**

- Pending customer order lines are aggregated by supplier
- Books are grouped via: book → publisher → supplier relationship
- Clerk can select a subset of aggregations for each supplier order (to reduce order size)
- Selected customer order lines are marked with a `placed` timestamp
- A supplier order is created with `created` timestamp

#### US3: Shipment Received & Reconciled

A shipment arrives from one or more suppliers. The clerk creates a reconciliation order, scans incoming books, and reconciles against ordered quantities.

**Acceptance Criteria:**

- One or more supplier orders can be selected for reconciliation
- Incoming books are scanned/added to the reconciliation order
- System compares delivered vs. ordered quantities
- On finalization:
  - Successfully received books are marked with `received` timestamp
  - Underdelivered books (if any) are rejected (placed = NULL) - latest-placed lines are rejected first
  - Overdelivered books (if any) are logged as warning and can reconcile with pending lines
- Customer orders become "Received" state

#### US4: Customer Collects Books

The customer returns to collect their books. The clerk marks the received books as collected.

**Acceptance Criteria:**

- Received books (with `received` timestamp) can be marked as collected
- Books are marked with `collected` timestamp
- Customer order becomes complete

#### US5: Configure Supplier Underdelivery Policy

A bookstore administrator configures how underdelivery is handled for each supplier.

**Acceptance Criteria:**

- Each supplier has an underdelivery policy setting (pending/queue)
- Policy can be set when creating a supplier
- Policy can be updated for existing suppliers
- Default policy is "pending"

#### US6: Automatic Continuation Orders (Queue Policy)

When a supplier with "queue" policy underdelivers, the system automatically creates a continuation order.

**Acceptance Criteria:**

- Underdelivered quantities are added to a new supplier order
- Continuation order is linked to the original order
- Customer order lines remain in "Placed" state
- Clerk can review and place the continuation order

---

## Technical Flow & Implementation

### Data Model

#### Customer Order Lines

Customer order lines track the state of each individual book ordered by a customer:

```sql
customer_order_lines (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  isbn TEXT,
  created INTEGER,      -- Timestamp when line was created
  placed INTEGER,       -- Timestamp when sent to supplier (nullable)
  received INTEGER,     -- Timestamp when received from supplier (nullable)
  collected INTEGER     -- Timestamp when collected by customer (nullable)
)
```

**Order Line States** (based on timestamp presence):

| State         | created | placed | received | collected |
| ------------- | ------- | ------ | -------- | --------- |
| **Pending**   | ✓       | ✗      | ✗        | ✗         |
| **Placed**    | ✓       | ✓      | ✗        | ✗         |
| **Received**  | ✓       | ✓      | ✓        | ✗         |
| **Collected** | ✓       | ✓      | ✓        | ✓         |

Status is derived via SQL query:

```sql
CASE
  WHEN collected IS NOT NULL THEN 3  -- Collected
  WHEN received IS NOT NULL THEN 2   -- Received
  WHEN placed IS NOT NULL THEN 1     -- Placed
  ELSE 0                             -- Pending
END AS status
```

#### Supplier Orders

```sql
supplier_order (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER,
  created INTEGER
)

supplier_order_line (
  supplier_order_id INTEGER,
  isbn TEXT,
  quantity INTEGER
)
```

The `supplier_order` table stores meta information about orders placed with suppliers. The `supplier_order_line` table tracks the ISBNs and quantities ordered with that supplier.

#### Reconciliation Orders

```sql
reconciliation_order (
  id INTEGER PRIMARY KEY,
  supplier_order_ids TEXT,  -- JSON array: [1, 2, 3]
  created INTEGER,
  updated_at INTEGER,
  finalized INTEGER  -- 0/1 boolean
)

reconciliation_order_line (
  reconciliation_order_id INTEGER,
  isbn TEXT,
  quantity INTEGER
)
```

Reconciliation orders link to supplier orders via a JSON array of IDs. This allows multiple supplier orders (even from different suppliers) to be reconciled in a single reconciliation order.

#### Book-publisher-supplier Relationship

```sql
book (
  isbn TEXT PRIMARY KEY,
  publisher TEXT,
  -- other book fields
)

supplier_publisher (
  supplier_id INTEGER,
  publisher TEXT,
  PRIMARY KEY (publisher)
)

supplier (
  id INTEGER,
  name TEXT,
  email TEXT,
  address TEXT,
  orderFormat TEXT,
  underdelivery_policy INTEGER DEFAULT 0  -- 0 = pending, 1 = queue
)
```

The `supplier` table stores supplier information including the underdelivery policy that determines how underdelivery is handled during reconciliation.

#### Supplier Order Continuation

```sql
supplier_order_continuation (
  parent_order_id INTEGER NOT NULL,
  continuation_order_id INTEGER NOT NULL,
  PRIMARY KEY (parent_order_id, continuation_order_id),
  FOREIGN KEY (parent_order_id) REFERENCES supplier_order(id),
  FOREIGN KEY (continuation_order_id) REFERENCES supplier_order(id)
)
```

The `supplier_order_continuation` table links continuation orders (created for underdelivery with "queue" policy) to their parent orders. This allows tracking of order relationships and history.

A publisher is associated with exactly one supplier. A "General" pseudo-supplier (supplier_id = NULL) handles books whose publishers are not associated with any configured supplier.

---

### Flow Implementation

#### Flow 1: Customer Order Creation

**Endpoints:** `addBooksToCustomer(customerId, bookIsbns[])`

```typescript
// customers.ts:211
await db.tx(async (db) => {
  const timestamp = Date.now();
  const params = bookIsbns.map((isbn) => [customerId, isbn, timestamp]).flat();

  // Insert book lines with created timestamp
  await db.exec(
    `INSERT INTO customer_order_lines (customer_id, isbn, created)
     VALUES ${multiplyString("(?,?,?)", bookIsbns.length)}`,
    params
  );

  // Update customer timestamp
  await db.exec("UPDATE customer SET updated_at = ? WHERE id = ?", [timestamp, customerId]);
});
```

**Key Points:**

- Each ISBN in the array becomes a separate order line
- Multiple copies of same book = multiple order lines with same ISBN
- All lines initially have only `created` timestamp → **Pending** state
- No explicit status field; derived from timestamp presence

---

#### Flow 2: Supplier Order Creation

**Endpoints:**

- `getPossibleSupplierOrders()` - List suppliers with aggregated pending lines
- `getPossibleSupplierOrderLines(supplierId)` - Get detailed pending lines for a supplier
- `createSupplierOrder(id, supplierId, orderLines[])` - Place supplier order

**Aggregation Query:**

```sql
-- suppliers.ts:259
SELECT
  supplier_id,
  COALESCE(supplier.name, 'General') as supplier_name,
  COALESCE(supplier.underdelivery_policy, 0) as underdelivery_policy,
  COUNT(*) as total_book_number,
  SUM(COALESCE(book.price, 0)) as total_book_price
FROM supplier
RIGHT JOIN supplier_publisher sp ON supplier.id = sp.supplier_id
RIGHT JOIN book ON sp.publisher = book.publisher
RIGHT JOIN customer_order_lines col ON book.isbn = col.isbn
WHERE col.placed IS NULL AND col.received IS NULL  -- Pending lines only
GROUP BY supplier.id, supplier.name, supplier.underdelivery_policy
ORDER BY supplier_name ASC
```

**Creating the Order:**

```typescript
// suppliers.ts:474
await db.tx(async (db) => {
  const timestamp = Date.now();

  // Create supplier order
  await db.execA(
    "INSERT INTO supplier_order (id, supplier_id, created) VALUES (?, ?, ?)",
    [id, supplierId, timestamp]
  );

  for (const { isbn, quantity } of orderLines) {
    // Find pending customer order lines for this ISBN (FCFS)
    const customerOrderLineIds = await db.execO<{id: number}>(
      "SELECT id FROM customer_order_lines
       WHERE isbn = ? AND placed is NULL
       ORDER BY created ASC LIMIT ?",
      [isbn, quantity]
    ).then(res => res.map(({id}) => id));

    // Mark as placed
    await db.exec(
      "UPDATE customer_order_lines SET placed = ? WHERE id IN (?,?,...)",
      [timestamp, ...customerOrderLineIds]
    );

    // Add to supplier order
    await db.exec(
      "INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
       VALUES (?, ?, ?)",
      [id, isbn, quantity]
    );

    // Track association history
    await db.exec(
      "INSERT INTO customer_order_line_supplier_order
       (customer_order_line_id, placed, supplier_order_id)
       VALUES ?, ?, ?)",
      values.flat()
    );
  }
});
```

**Key Points:**

- Only `placed IS NULL AND received IS NULL` lines are eligible
- Lines selected by FCFS: `ORDER BY created ASC`
  Clerk can select subset of aggregated lines via UI checkboxes
- Excess supplier order quantity is allowed (no strict validation)
- History table tracks which supplier order each line went through

**Supplier Order Creation with Underdelivery Policy:**

When creating or updating a supplier, the underdelivery policy can be configured:

```typescript
// suppliers.ts:110-127
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
    supplier.underdelivery_policy ?? 0 // Default to pending
    // ... update values
  ]
);
```

**Key Points:**

- Default policy is `0` (pending)
- Policy can be changed at any time
- Policy affects future reconciliations only

---

#### Flow 3: Shipment Reconciliation

**Endpoints:**

- `createReconciliationOrder(id, supplierOrderIds[])`
- `upsertReconciliationOrderLines(id, lines[])` - Add scanned books
- `getReconciliationOrderLines(id)` - Get scanned books
- `finalizeReconciliationOrder(id)` - Complete reconciliation

**Creating Reconciliation Order:**

```typescript
// order-reconciliation.ts:79
const supplierOrderIds = _supplierOrderIds.sort((a, b) => a - b); // Sort for consistency
const timestamp = Date.now();

// Check orders exist and aren't already reconciling
await db.exec(
  `INSERT INTO reconciliation_order (id, supplier_order_ids, created, updatedAt)
   VALUES (?, json_array(?, ?, ...), ?, ?)}`,
  [id, ...supplierOrderIds, timestamp, timestamp]
);
```

**Adding Scanned Books:**

```typescript
// order-reconciliation.ts:253
await db.tx(async (txDb) => {
  const sql = `
    INSERT INTO reconciliation_order_lines (reconciliation_order_id, isbn, quantity)
    VALUES (?,?,?), (?,?,?), ...
    ON CONFLICT(reconciliation_order_id, isbn) DO UPDATE SET
      quantity = quantity + excluded.quantity;
  `;
  await txDb.exec(sql, params);

  // Remove zero-quantity lines
  await txDb.exec(
    "DELETE FROM reconciliation_order_lines
     WHERE reconciliation_order_id = ? AND quantity <= 0",
    [id]
  );
});
```

**Finalizing - The Core Logic:**

```typescript
// order-reconciliation.ts:367
const receivedLinesQuery = `
  SELECT
    isbn,
    quantity
  FROM reconciliation_order_lines
  WHERE reconciliation_order_id = ?
`;
const receivedLineBudget = await db.execA<[isbn: string, quantity: number]>(receivedLinesQuery, [id]).then((res) => new Map(res));

const supplierOrderLineQuery = `
  SELECT
    so.supplier_id,
    sol.supplier_order_id,
    sol.isbn,
    sol.quantity,
    so.created,
    s.underdelivery_policy
  FROM supplier_order_line sol
  LEFT JOIN supplier_order so ON sol.supplier_order_id = so.id
  LEFT JOIN supplier s ON so.supplier_id = s.id
  WHERE sol.supplier_order_id IN (${multiplyString("?", supplierOrderIds.length)})
  ORDER BY so.created ASC
`;

type SupplierOrderLineItem = {
  supplier_id: number;
  supplier_order_id: number;
  isbn: string;
  quantity: number;
  underdelivery_policy: 0 | 1;
  created: number;
};
const supplierOrderLines = await db.execO<SupplierOrderLineItem>(supplierOrderLineQuery, supplierOrderIds);

const isbns = [...new Set(supplierOrderLines.map(({ isbn }) => isbn))];
const customerOrderLines = await getCustomerOrderLinesCore(db, { isbns, orderBy: "created ASC", status: { eq: OrderItemStatus.Placed } });

const customerOrdersByISBN = new Map<string, number[]>();
for (const { isbn, id } of customerOrderLines) {
  const existing = customerOrdersByISBN.get(isbn) || [];
  existing.push(id);
  customerOrdersByISBN.set(isbn, existing);
}

const linesToDeliver: number[] = [];
const linesToReject: number[] = [];
type ContinuationOrderLine = { parent_order_id: number; supplier_id: number; isbn: string; quantity: number };
const continuationOrderLines: ContinuationOrderLine[] = [];

for (const { isbn, quantity: ordered, supplier_id, supplier_order_id, underdelivery_policy } of supplierOrderLines) {
  const budget = receivedLineBudget.get(isbn) || 0;
  const delivered = Math.min(ordered, budget);
  const remainingBudget = budget - delivered;
  const underdelivered = ordered - delivered;

  receivedLineBudget.set(isbn, remainingBudget);

  if (delivered > 0) {
    const customerOrderLines = customerOrdersByISBN.get(isbn) || [];

    if (customerOrderLines.length < delivered) {
      const msg = [
        "unexpected state: remaining placed customer order lines < delivered lines",
        `  isbn: ${isbn}`,
        `  delivered: ${delivered}`,
        `  remining customer orders: ${customerOrderLines.length}`
      ].join("\n");
      throw new Error(msg);
    }

    const idsToDeliver = customerOrderLines.splice(0, delivered);

    linesToDeliver.push(...idsToDeliver);
    customerOrdersByISBN.set(isbn, customerOrderLines);
  }

  if (underdelivered > 0 && underdelivery_policy === 0) {
    const customerOrderLines = customerOrdersByISBN.get(isbn) || [];

    if (customerOrderLines.length < underdelivered) {
      const msg = [
        "unexpected state: remaining placed customer order lines < underdelivered lines",
        `  isbn: ${isbn}`,
        `  underdelivered: ${underdelivered}`,
        `  remaining customer orders: ${customerOrderLines.length}`
      ].join("\n");
      throw new Error(msg);
    }

    const idsToReject = customerOrderLines.splice(-underdelivered, underdelivered);

    linesToReject.push(...idsToReject);
    customerOrdersByISBN.set(isbn, customerOrderLines);
  }

  if (underdelivered > 0 && underdelivery_policy === 1) {
    continuationOrderLines.push({ isbn, quantity: underdelivered, supplier_id, parent_order_id: supplier_order_id });
  }
}

return db.tx(async (txDb) => {
  const timestamp = Date.now();
  await txDb.exec(`UPDATE reconciliation_order SET finalized = 1, updatedAt = ? WHERE id = ?;`, [timestamp, id]);

  if (linesToDeliver.length > 0) {
    await txDb.exec(`UPDATE customer_order_lines SET received = ? WHERE id IN (${multiplyString("?", linesToDeliver.length)})`, [
      timestamp,
      ...linesToDeliver
    ]);
  }

  if (linesToReject.length > 0) {
    await txDb.exec(`UPDATE customer_order_lines SET placed = NULL WHERE id IN (${multiplyString("?", linesToReject.length)})`, [
      timestamp,
      ...linesToReject
    ]);
  }

  const continuationOrders = _group(continuationOrderLines, (line) => [line.parent_order_id, line]);
  for (const [parent_order_id, _lines] of continuationOrders) {
    const lines = [..._lines];

    const id = Math.floor(Math.random() * 1000000);
    const supplierId = lines[0].supplier_id;

    await txDb.exec("INSERT INTO supplier_order (id, supplier_id, created) VALUES (?, ?, ?)", [id, supplierId, timestamp]);
    await txDb.exec("INSERT INTO supplier_order_continuation (parent_order_id, continuation_order_id) VALUES (?, ?)", [
      parent_order_id,
      id
    ]);

    const placeholders = Array(lines.length).fill("(?, ?, ?)").join(",\n");
    const params = lines.flatMap(({ isbn, quantity }) => [id, isbn, quantity]);
    await txDb.exec(`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity) VALUES ${placeholders}`, params);
  }
});
```

**Key Points:**

1. **Fulfillment** - First `receivedQuantity` lines are marked as `received`:

   - Lines ordered by `created ASC` (FCFS)
   - This satisfies: "first order placed gets first book"

2. **Underdelivery** - Excess `(ordered - received)` lines are handled based on policy:

   **Policy = "pending" (0):**

   - From remaining lines, filter to `placed IS NOT NULL` only
   - Sort by `created DESC`, take first M
   - Set `placed = NULL` (back to **Pending** state)
   - These lines re-appear in the "Unordered" supplier orders view

   **Policy = "queue" (1):**

   - Create continuation order with underdelivered quantities
   - Link continuation order to parent order
   - Customer order lines remain in **Placed** state
   - Clerk can review and place continuation order

3. **Overdelivery** - Extra books spill over:

   - If `receivedQuantity > orderedQuantity`, query continues until all received books assigned
   - Can reconcile lines from other supplier orders or even `placed IS NULL` (pending) lines
   - Warning logged but lines aren't rejected
   - This satisfies: "overdelivery can serve pending orders early"

4. **Isolation** - The query uses `received IS NULL` (not `placed IS NOT NULL`) to find all un-reconciled lines, allowing overdelivery to reconcile pending lines too.

5. **Continuation Orders** - When policy is "queue":
   - New supplier orders are automatically created for underdelivered items
   - Orders are linked via `supplier_order_continuation` table
   - Allows tracking of order relationships and history

---

### Underdelivery Policy

When a supplier delivers fewer books than ordered, the system handles underdelivery based on the supplier's **underdelivery policy** setting. Each supplier can be configured with one of two policies:

#### Policy Options

**1. Pending (default)**

- Underdelivered books are rejected and returned to **Pending** state
- Customer order lines have `placed = NULL` set
- Books reappear in the "Unordered" supplier orders view
- Clerk must manually reorder these books

**2. Queue**

- Underdelivered books are automatically added to a **continuation order**
- A new supplier order is created with the missing quantities
- The continuation order is linked to the original order via `supplier_order_continuation` table
- Customer order lines remain in **Placed** state
- Clerk can review and place the continuation order

#### Configuration

The underdelivery policy is configured per supplier:

```typescript
type Supplier = {
  id?: number | null;
  name?: string;
  email?: string;
  address?: string;
  customerId?: number;
  orderFormat?: Format;
  underdelivery_policy?: 0 | 1; // 0 = pending, 1 = queue
};
```

**UI Location:**

- Supplier Card: Displays current policy ("pending" or "queue")
- Supplier Form: Dropdown to select policy when creating/updating suppliers

#### Reconciliation Flow with Underdelivery Policy

**When Policy = "pending" (0):**

```typescript
// order-reconciliation.ts:472-491
if (underdelivered > 0 && underdelivery_policy === 0) {
  // Reject underdelivered lines (set placed = NULL)
  const idsToReject = customerOrderLines.splice(-underdelivered, underdelivered);
  linesToReject.push(...idsToReject);
}
```

**When Policy = "queue" (1):**

```typescript
// order-reconciliation.ts:494-496
if (underdelivered > 0 && underdelivery_policy === 1) {
  // Create continuation order line
  continuationOrderLines.push({ isbn, quantity: underdelivered, supplier_id, parent_order_id: supplier_order_id });
}

// Later: Create continuation orders
// order-reconciliation.ts:518-534
const continuationOrders = _group(continuationOrderLines, (line) => [line.parent_order_id, line]);
for (const [parent_order_id, _lines] of continuationOrders) {
  // Create new supplier order
  await txDb.exec("INSERT INTO supplier_order (id, supplier_id, created) VALUES (?, ?, ?)", [id, supplierId, timestamp]);
  // Link to parent order
  await txDb.exec("INSERT INTO supplier_order_continuation (parent_order_id, continuation_order_id) VALUES (?, ?)", [parent_order_id, id]);
  // Add underdelivered lines
  await txDb.exec(`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity) VALUES ...`, params);
}
```

#### Database Schema Updates

**Supplier Table:**

```sql
ALTER TABLE supplier ADD COLUMN underdelivery_policy INTEGER DEFAULT 0;
-- 0 = pending, 1 = queue
```

**Supplier Order Continuation Table:**

```sql
CREATE TABLE supplier_order_continuation (
  parent_order_id INTEGER NOT NULL,
  continuation_order_id INTEGER NOT NULL,
  PRIMARY KEY (parent_order_id, continuation_order_id),
  FOREIGN KEY (parent_order_id) REFERENCES supplier_order(id),
  FOREIGN KEY (continuation_order_id) REFERENCES supplier_order(id)
);
```

**PlacedSupplierOrder Type:**

```typescript
export type PlacedSupplierOrder = {
  id: number;
  created: number;
  reconciliation_order_id: number | null;
  reconciliation_last_updated_at: number | null;
  finalized: number | null;
  parent_order_id: number | null; // NEW: Links to continuation parent
} & PossibleSupplierOrder;
```

#### UI Components

**SupplierCard Component:**

- Displays underdelivery policy with History icon
- Shows "pending" or "queue" label

**ReconcileStep2 Component:**

- Shows UnderdeliveryActionBadge for each supplier order
- Badge displays action based on policy:
  - "Order marked as pending delivery" (pending policy)
  - "Missing books added to order queue" (queue policy)

**SupplierMetaForm Component:**

- Dropdown to select underdelivery policy
- Options: "pending" (default) and "queue"

---

#### Flow 4: Customer Collection

**Endpoint:** `markCustomerOrderLinesAsCollected(ids[])`

```typescript
// customers.ts:345
const timestamp = Date.now();
await db.exec(
  "UPDATE customer_order_lines SET collected = ?
   WHERE id IN (?, ?, ...)",
  [timestamp, ...ids]
);

// Update customer timestamps
await db.exec(
  "UPDATE customer SET updated_at = ?
   WHERE id IN (SELECT DISTINCT customer_id FROM customer_order_lines WHERE id IN (?, ?, ...))",
  [timestamp, ...ids]
);
```

**Key Points:**

- Explicit step separate from receiving
- Only affects lines that already have `received IS NOT NULL`
- Customer order marked complete only when ALL lines have `collected IS NOT NULL`
- Customer order list shows `completed` flag for status

---

## Bug Fixes

### 1. Date Formatting in ReconciliationCustomerNotification

**Issue:** Customer order dates were displayed as raw timestamps instead of formatted dates.

**Fix:** Added proper date formatting using i18n formatters:

```typescript
// ReconciliationCustomerNotification.svelte:35-39
function formatOrderDate(created: Date): string {
  const datePart = $dateFormatters.dateShort(created);
  const timePart = $dateFormatters.timeOnly(created);
  return `${datePart}, ${timePart}`;
}
```

**Impact:** Customer order dates now display as "Feb 17, 2026, 2:30 PM" instead of raw timestamps.

### 2. Customer Order Retrieval - Status Filter

**Issue:** Customer order retrieval was using `status: { lte: OrderItemStatus.Placed }` which included pending orders in reconciliation.

**Fix:** Changed to `status: { eq: OrderItemStatus.Placed }` to only include placed orders:

```typescript
// order-reconciliation.ts:415
const customerOrderLines = await getCustomerOrderLinesCore(db, {
  isbns,
  orderBy: "created ASC",
  status: { eq: OrderItemStatus.Placed } // Changed from lte to eq
});
```

**Impact:** Reconciliation now correctly processes only placed customer orders, preventing premature fulfillment of pending orders.

### 3. Null Checks in Delivery Stats Calculation

**Issue:** Potential runtime errors when customer order lines are undefined.

**Fix:** Added null checks and fallbacks:

```typescript
// utils.ts:23, 68
const remainingScanned = scannedLineLookup.get(isbn) || 0; // Added fallback
customers: [...(customerLineLookup.get(isbn) || [])].slice(0, quantity); // Added fallback
```

**Impact:** Prevents runtime errors when lookup maps return undefined.

### 4. Length Checks Before DB Updates

**Issue:** DB update queries were executed even when there were no lines to update.

**Fix:** Added length checks before DB operations:

```typescript
// order-reconciliation.ts:503-515
if (linesToDeliver.length > 0) {
  // NEW: Length check
  await txDb.exec(`UPDATE customer_order_lines SET received = ? WHERE id IN (...)`, [timestamp, ...linesToDeliver]);
}

if (linesToReject.length > 0) {
  // NEW: Length check
  await txDb.exec(`UPDATE customer_order_lines SET placed = NULL WHERE id IN (...)`, [timestamp, ...linesToReject]);
}
```

**Impact:** Prevents unnecessary DB operations and potential SQL errors with empty IN clauses.

### 5. Centralized Type Definitions

**Issue:** Duplicate type definitions across multiple components.

**Fix:** Centralized common types in `types.ts`:

```typescript
// types.ts:89-90
export type CustomerDeliveryEntry = Pick<CustomerOrderLine, "fullname" | "customer_display_id" | "created">;
export type DeliveryByISBN = { isbn: string; title: string; total: number; customers: CustomerDeliveryEntry[] };
```

These types are now imported by:

- `ReconciliationCustomerNotification.svelte`
- `routes/orders/suppliers/reconcile/[id]/utils.ts`

**Benefits:**

- Single source of truth for type definitions
- Easier to maintain and update
- Prevents type inconsistencies

---

## Edge Cases

### 1. General Supplier (No Publisher Association)

Books without publisher-to-supplier associations aggregate to a "General" pseudo-supplier:

```sql
-- suppliers.ts:262
COALESCE(supplier.name, 'General') as supplier_name
FROM supplier
RIGHT JOIN supplier_publisher sp ON supplier.id = sp.supplier_id
-- ... joins ...
WHERE supplier.id IS NULL  -- General supplier
```

This ensures all pending customer order lines are orderable, even without explicit supplier configuration.

---

### 2. Concurrent Reconciliation Prevention

A supplier order cannot be in multiple active reconciliation orders:

```typescript
// order-reconciliation.ts:101
const existingReconOrders = await getAllReconciliationOrders(db);
const conflicts = existingReconOrders
  .map((order) => ({ ...order, supplierOrderIds: order.supplierOrderIds.filter((id) => supplierOrderIds.includes(id)) }))
  .filter((order) => order.supplierOrderIds.length);

if (conflicts.length) {
  throw new ErrSupplierOrdersAlreadyReconciling(supplierOrderIds, conflicts);
}
```

The implementation uses a JSON array stored in `reconciliation_order.supplier_order_ids`. While this design is acknowledged as suboptimal (TODO comment at line 102), it works for the current scale.

---

### 3. Overdelivery Without Pending Lines

If overdelivered books exist but no pending customer order lines to reconcile:

```typescript
// order-reconciliation.ts:452
// NOTE: Currently, if the number delivered is greater for this supplier order, but there are additional customer order lines for a particular book,
// they will be reconcile early and extra stock will happen only after there are no more customer order lines to receive, but the books keep coming in.
```

If all in-progress lines are satisfied but more books arrive, they would theoretically go to inventory. However, this edge case is not explicitly handled and results in a console warning only. Future considerations include integrating with warehouse/inbound notes.

---

### 4. Exact Finalization Protection

Finalized reconciliation orders cannot be modified:

```typescript
// order-reconciliation.ts:360, 261, 300
if (reconOrder.finalized) {
  throw new ErrReconciliationOrderFinalized(id);
}
```

This applies to: adding lines, deleting lines, deleting the order itself.

---

### 5. Empty Reconciliation Order

Must be based on at least one supplier order:

```typescript
// order-reconciliation.ts:80
if (!_supplierOrderIds.length) {
  throw new Error("Reconciliation order must be based on at least one supplier order");
}
```

---

### 6. Zero Quantity Line Cleanup

When modifying reconciliation lines, zero-quantity items are removed:

```sql
-- order-reconciliation.ts:276
DELETE FROM reconciliation_order_lines
WHERE reconciliation_order_id = ? AND quantity <= 0
```

This ensures clean data when quantities are adjusted or corrected.

---

### 7. Customer Order Line History

The `customer_order_line_supplier_order` table tracks when a line was placed with each supplier:

```sql
customer_order_line_supplier_order (
  customer_order_line_id INTEGER,
  placed INTEGER,
  supplier_order_id INTEGER
)
```

This provides an audit trail of which supplier fulfilled which customer order lines.

---

### 8. Mixed Supplier Reconciliations

Multiple supplier orders from different suppliers can be reconciled in a single reconciliation order:

```typescript
const supplierOrderIds = [1, 2, 3]; // Can be from different suppliers
await createReconciliationOrder(db, id, supplierOrderIds);
```

The consolidation allows handling of split or combined shipments more efficiently.

---

### 9. Underdelivery Policy Behavior

The underdelivery policy determines how missing books are handled during reconciliation:

**Pending Policy (default):**

- Underdelivered books are rejected and returned to pending state
- Customer order lines have `placed = NULL` set
- Books must be manually reordered
- Suitable for suppliers with unreliable delivery

**Queue Policy:**

- Underdelivered books are automatically added to continuation order
- Customer order lines remain in placed state
- Continuation order is linked to parent order
- Suitable for suppliers with reliable but incomplete delivery

**Implementation:**

```typescript
// order-reconciliation.ts:472-496
if (underdelivered > 0) {
  if (underdelivery_policy === 0) {
    // Reject lines
    const idsToReject = customerOrderLines.splice(-underdelivered, underdelivered);
    linesToReject.push(...idsToReject);
  } else if (underdelivery_policy === 1) {
    // Create continuation order
    continuationOrderLines.push({
      isbn,
      quantity: underdelivered,
      supplier_id,
      parent_order_id: supplier_order_id
    });
  }
}
```

---

## Summary Table

| Step | Action                                         | Customer Order Line State                      | Key Tables                                                                     |
| ---- | ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | Customer places order                          | **Pending** (created timestamp)                | `customer_order_lines`                                                         |
| 2    | Bookshop orders from supplier                  | **Placed** (placed timestamp)                  | `supplier_order`, `customer_order_lines`, `customer_order_line_supplier_order` |
| 3a   | Reconciliation: received books                 | **Received** (received timestamp)              | `reconciliation_order`, `reconciliation_order_lines`                           |
| 3b   | Reconciliation: underdelivery (pending policy) | Back to **Pending** (placed = NULL)            | `customer_order_lines`                                                         |
| 3c   | Reconciliation: underdelivery (queue policy)   | Remains **Placed**, continuation order created | `supplier_order_continuation`, `supplier_order_line`                           |
| 3d   | Reconciliation: overdelivery spillover         | **Received** (even if not placed)              | `customer_order_lines`                                                         |
| 4    | Customer collects                              | **Collected** (collected timestamp)            | `customer_order_lines`                                                         |

**First-Come-First-Served Implementation:**

1. **Order placement:** Customer order lines selected by `ORDER BY created ASC LIMIT quantity`
2. **Reconciliation fulfillment:** Lines marked received in `created ASC` order
3. **Reconciliation rejection:** Latest-placed (not latest-created) lines rejected (reverse of placed set)

**State Transition Graph:**

```
[Pending] --order placed--> [Placed] --reconciliation--> [Received] --collection--> [Collected]
  ^                                                         |
  |------------ underdelivery (pending policy, placed=NULL) -|
  |------------ underdelivery (queue policy, continuation order created) -|
  |----------- overdelivery spillover from received --------|
```
