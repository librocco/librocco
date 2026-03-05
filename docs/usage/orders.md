# Orders

This document describes the current order flow implemented in the web client database layer.

Scope:

- customer ordering (`customer`, `customer_order_lines`)
- supplier ordering (`supplier_order`, `supplier_order_line`)
- reconciliation (`reconciliation_order`, `reconciliation_order_lines`)
- collection (`collected` timestamp on customer order lines)
- underdelivery handling (`underdelivery_policy`, `supplier_order_continuation`)

Primary implementation files:

- `apps/web-client/src/lib/db/cr-sqlite/customers.ts`
- `apps/web-client/src/lib/db/cr-sqlite/suppliers.ts`
- `apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts`
- `apps/web-client/src/lib/db/cr-sqlite/types.ts`

---

## Core model

A customer order is a set of customer order lines linked by `customer_id` + a `customer` table entry (customer = customer order)

Each line moves through states by timestamps:

- `created` only -> Pending
- `created + placed` -> Placed
- `created + placed + received` -> Received
- `created + placed + received + collected` -> Collected

Status is derived in SQL with this precedence:

```sql
CASE
  WHEN collected IS NOT NULL THEN 3
  WHEN received IS NOT NULL THEN 2
  WHEN placed IS NOT NULL THEN 1
  ELSE 0
END AS status
```

The UI-level "completed" flag for a customer is computed from `MIN(status)` across that customer's lines: completed means all lines are collected.

---

## Data structures

### Customer order lines

Representative fields used by the flow:

```sql
customer_order_lines (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  isbn TEXT,
  created INTEGER NOT NULL,
  placed INTEGER NULL,
  received INTEGER NULL,
  collected INTEGER NULL
)
```

Line history for placements is captured in:

```sql
customer_order_line_supplier_order (
  customer_order_line_id INTEGER,
  placed INTEGER,
  supplier_order_id INTEGER
)
```

### Supplier ordering

```sql
supplier_order (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER NULL,
  created INTEGER NOT NULL
)

supplier_order_line (
  supplier_order_id INTEGER,
  isbn TEXT,
  quantity INTEGER
)
```

`supplier_id = NULL` is the "General" pseudo-supplier used for books whose publisher is not associated to any configured supplier.

Supplier policy for underdelivery:

```sql
supplier.underdelivery_policy INTEGER DEFAULT 0
-- 0 = pending, 1 = queue
```

[see more](./underdelivery-policy.md)

Continuation link table (used only in case of `underdelivery_policy = 1`):

```sql
supplier_order_continuation (
  parent_order_id INTEGER,
  continuation_order_id INTEGER,
  PRIMARY KEY (parent_order_id, continuation_order_id)
)
```

### Reconciliation

```sql
reconciliation_order (
  id INTEGER PRIMARY KEY,
  supplier_order_ids TEXT, -- JSON array of supplier order ids
  created INTEGER,
  updatedAt INTEGER,
  finalized INTEGER DEFAULT 0
)

reconciliation_order_lines (
  reconciliation_order_id INTEGER,
  isbn TEXT,
  quantity INTEGER,
  PRIMARY KEY (reconciliation_order_id, isbn)
)
```

Important: selected supplier order ids are stored as JSON in a single column (`supplier_order_ids`), not in a join table.

---

## Flow 1: Add books to customer

Function: `addBooksToCustomer(db, customerId, bookIsbns)`.

Behavior:

- inserts one `customer_order_lines` row per ISBN
- sets `created = Date.now()` for each line
- updates `customer.updated_at`

Notes:

- duplicate ISBNs are allowed and become separate lines
- lines start as Pending (`placed/received/collected` are null)

---

## Flow 2: Build and place supplier orders

Main functions:

- `getPossibleSupplierOrders()`
- `getPossibleSupplierOrderLines(supplierId)`
- `createSupplierOrder(db, id, supplierId, orderLines)`

### 2.1 Candidate lines

Candidates are customer order lines where:

- `placed IS NULL`
- `received IS NULL`

This intentionally includes lines that were previously placed and then set back to pending because of underdelivery (`placed` reset to null).

### 2.2 Grouping by supplier

Supplier grouping path is:

`customer_order_lines -> book -> supplier_publisher -> supplier`

If no supplier matches, data is grouped under "General" (`supplier_id = NULL`).

### 2.3 Placing an order

For each requested `{ isbn, quantity }`:

1. select up to `quantity` pending customer lines by `created ASC`
2. set `placed = timestamp` for selected lines
3. insert one `supplier_order_line`
4. insert placement history rows in `customer_order_line_supplier_order`

Important implementation detail:

- the system allows ordering more quantity than currently pending customer lines
- only existing pending lines are marked as placed; extra ordered quantity stays only on supplier order lines

---

## Flow 3: Reconciliation

Main functions:

- `createReconciliationOrder(db, id, supplierOrderIds)`
- `upsertReconciliationOrderLines(db, id, lines)`
- `getReconciliationOrderLines(db, id)`
- `deleteOrderLineFromReconciliationOrder(db, id, isbn)`
- `finalizeReconciliationOrder(db, id)`

### 3.1 Create reconciliation order

Validation:

- `supplierOrderIds` must be non-empty
- all ids must exist in `supplier_order`
- ids cannot overlap with any existing reconciliation order (current check inspects JSON arrays)

Stored values:

- supplier ids list in `supplier_order_ids` as JSON array
- `created` and `updatedAt` timestamps

### 3.2 Scan/update delivered lines

`upsertReconciliationOrderLines` performs an upsert by `(reconciliation_order_id, isbn)` and adds quantities.

Additional behavior:

- negative deltas are allowed
- rows with `quantity <= 0` are deleted
- order `updatedAt` is refreshed
- finalized orders are immutable (operations throw)

### 3.3 Finalization logic

Finalization uses:

- delivered budget from `reconciliation_order_lines`
- ordered supplier lines from `supplier_order_line` joined to supplier policy
- customer lines filtered to `status = Placed` and sorted by `created ASC`

Per supplier-order line:

1. `delivered = min(ordered, budget)`
2. mark earliest placed customer lines as deliverable (`received`)
3. if underdelivered:
   - policy `pending` (0): reject newest remaining placed lines for that ISBN by setting `placed = NULL`
   - policy `queue` (1): create continuation supplier-order payload

Transaction effects on finalize:

- mark reconciliation order as finalized
- set `received = timestamp` for delivered customer lines
- set `placed = NULL` for rejected customer lines
- create continuation supplier orders and links for queue policy

---

## Flow 4: Customer collection

Function: `markCustomerOrderLinesAsCollected(db, ids)`.

Behavior:

- if `ids` is empty, returns immediately
- sets `collected = timestamp` for provided line ids
- updates `customer.updated_at` for affected customers

The function does not enforce `received IS NOT NULL` itself; callers are expected to pass valid line ids.

---

## Underdelivery policy

Policy is stored per supplier as:

- `0` -> pending (default)
- `1` -> queue

At reconciliation finalize:

- pending policy returns missing units to pending state (`placed = NULL`)
- queue policy creates continuation supplier orders linked by `supplier_order_continuation`

Continuation orders are grouped by parent supplier order, and each continuation receives a newly generated numeric id.

---

## Constraints and edge behavior

- finalized reconciliation orders cannot be modified or deleted
- reconciliation order must reference at least one supplier order
- the same supplier order cannot be attached to multiple reconciliation orders
- deleting a supplier is blocked if it has active orders (unreconciled or in unfinalized reconciliation)
- "General" supplier bucket captures books without publisher-supplier mapping

---

## Current limitations (as implemented)

- reconciliation stores supplier order ids as JSON, not normalized join rows
- overdelivery beyond total ordered quantity in the selected supplier orders is not applied to pending customer lines during finalize (extra delivered budget is effectively ignored)
- continuation supplier order ids are generated with a temporary random strategy in code

These are implementation realities, not business requirements.
