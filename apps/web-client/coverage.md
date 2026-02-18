# Coverage Review

- **Date**: 2026-02-18
- **Base commit**: `9e1e9ae5f001b79d31eb609b3fd87f5fbf12f4b6`
- **Proposed tests**: 14

| Category | Count |
|----------|-------|
| 🆕 New Functionality | 6 |
| 🔲 Edge Case | 6 |
| 🔄 Modified Behavior | 2 |

## Summary

This review analyzes test coverage for changes introducing the underdelivery policy feature, supplier order continuation, and various bug fixes. The major new functionality (underdelivery policy with pending/queue modes and continuation orders) has **NO test coverage**. Existing tests were updated to accommodate new fields but do not verify the new behavior.

---

## Changed Areas

### `apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts`

**Changes**: Major refactor of _finalizeReconciliationOrder to support underdelivery policy (pending/queue) and automatic continuation order creation. Added logic to handle underdelivery based on supplier policy: pending policy rejects lines (placed=NULL), queue policy creates continuation orders.

**Existing coverage**: Existing tests cover basic reconciliation scenarios but do NOT test underdelivery policy behavior or continuation order creation. Tests verify delivery and rejection but assume old behavior (always reject underdelivered).

### `apps/web-client/src/lib/db/cr-sqlite/suppliers.ts`

**Changes**: Added underdelivery_policy field to supplier queries and upsert operations. Added parent_order_id to PlacedSupplierOrder type and queries. Modified _getPlacedSupplierOrders to join with supplier_order_continuation table.

**Existing coverage**: Tests updated to expect underdelivery_policy field in results, but do NOT test policy configuration, updates, or continuation order relationships.

### `apps/web-client/src/lib/db/cr-sqlite/types.ts`

**Changes**: Added underdelivery_policy to Supplier and SupplierExtended types. Added parent_order_id to PlacedSupplierOrder type. Renamed fullname to customer_name in DBCustomerOrderLine and CustomerOrderLine. Added CustomerDeliveryEntry and DeliveryByISBN types.

**Existing coverage**: Type changes are reflected in test expectations but no tests verify the new types or their usage.

### `apps/web-client/src/lib/db/cr-sqlite/customers.ts`

**Changes**: Modified getCustomerOrderLinesCore to support orderBy parameter and changed status filter from lte to eq. Renamed fullname to customer_name in query.

**Existing coverage**: No tests verify the new orderBy parameter or the status filter change from lte to eq.

### `apps/web-client/src/lib/schemas/init`

**Changes**: Added underdelivery_policy column to supplier table with CHECK constraint. Created supplier_order_continuation table to link parent and continuation orders.

**Existing coverage**: No tests verify schema changes or constraints.

---

## Proposed Tests

### 1. finalizeReconciliationOrder should reject underdelivered customer order lines when supplier has pending policy (0)

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🆕 New Functionality

**Rationale**: Core behavior for pending underdelivery policy - underdelivered books should be rejected and returned to pending state

**Setup (Arrange)**:
Create supplier with underdelivery_policy=0. Create customer orders for 3 copies of same book. Place supplier order for 3 copies. Create reconciliation order with only 2 copies delivered.

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify 2 customer order lines have received timestamp. Verify 1 customer order line has placed=NULL (rejected). Verify rejected line appears in getPossibleSupplierOrders.

**Code sketch**:
```ts
const supplier = { id: 1, name: "Test Supplier", underdelivery_policy: 0 };
await upsertSupplier(db, supplier);
await addBooksToCustomer(db, 1, ["1", "1", "1"]);
await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 3, supplier_id: 1 }]);
await createReconciliationOrder(db, 1, [1]);
await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 2 }]);
await finalizeReconciliationOrder(db, 1);
const lines = await getCustomerOrderLines(db, 1);
expect(lines.filter(l => l.received).length).toBe(2);
expect(lines.filter(l => l.placed === null).length).toBe(1);
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> check if existing tests test for this (pending underdelivery policy is the default one and the previous implementation had that behaviour -- as the only behaviour)
>

---

### 2. finalizeReconciliationOrder should create continuation order when supplier has queue policy (1)

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🆕 New Functionality

**Rationale**: Core behavior for queue underdelivery policy - underdelivered books should be added to continuation order

**Setup (Arrange)**:
Create supplier with underdelivery_policy=1. Create customer orders for 3 copies of same book. Place supplier order for 3 copies. Create reconciliation order with only 2 copies delivered.

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify 2 customer order lines have received timestamp. Verify 1 customer order line remains placed (not rejected). Verify continuation order was created with 1 copy. Verify continuation order linked to parent via supplier_order_continuation table.

**Code sketch**:
```ts
const supplier = { id: 1, name: "Test Supplier", underdelivery_policy: 1 };
await upsertSupplier(db, supplier);
await addBooksToCustomer(db, 1, ["1", "1", "1"]);
await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 3, supplier_id: 1 }]);
await createReconciliationOrder(db, 1, [1]);
await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 2 }]);
await finalizeReconciliationOrder(db, 1);
const lines = await getCustomerOrderLines(db, 1);
expect(lines.filter(l => l.received).length).toBe(2);
expect(lines.filter(l => l.placed !== null && l.received === undefined).length).toBe(1);
const orders = await getPlacedSupplierOrders(db);
const continuationOrder = orders.find(o => o.parent_order_id === 1);
expect(continuationOrder).toBeDefined();
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> approve
>

---

### 3. finalizeReconciliationOrder should group multiple underdelivered items into single continuation order per parent

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🆕 New Functionality

**Rationale**: Verify that multiple underdelivered books from same parent order are grouped into one continuation order

**Setup (Arrange)**:
Create supplier with underdelivery_policy=1. Create customer orders for 2 different books (2 copies each). Place supplier order for both. Create reconciliation order with only 1 copy of each delivered.

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify only 1 continuation order created. Verify continuation order contains both underdelivered books (1 copy each). Verify parent_order_id links to original order.

**Code sketch**:
```ts
const supplier = { id: 1, name: "Test Supplier", underdelivery_policy: 1 };
await upsertSupplier(db, supplier);
await addBooksToCustomer(db, 1, ["1", "1", "2", "2"]);
await createSupplierOrder(db, 1, 1, [
  { isbn: "1", quantity: 2, supplier_id: 1 },
  { isbn: "2", quantity: 2, supplier_id: 1 }
]);
await createReconciliationOrder(db, 1, [1]);
await upsertReconciliationOrderLines(db, 1, [
  { isbn: "1", quantity: 1 },
  { isbn: "2", quantity: 1 }
]);
await finalizeReconciliationOrder(db, 1);
const orders = await getPlacedSupplierOrders(db);
const continuationOrders = orders.filter(o => o.parent_order_id === 1);
expect(continuationOrders.length).toBe(1);
const continuationLines = await getPlacedSupplierOrderLines(db, [continuationOrders[0].id]);
expect(continuationLines.length).toBe(2);
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> approve
>

---

### 4. upsertSupplier should create supplier with underdelivery_policy and default to 0 (pending)

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/suppliers-publishers.test.ts`
- **Category**: 🆕 New Functionality

**Rationale**: Verify suppliers can be created with underdelivery policy and default is correct

**Setup (Arrange)**:
Create supplier without underdelivery_policy specified

**Action (Act)**:
Call upsertSupplier

**Assertion (Assert)**:
Verify supplier created with underdelivery_policy=0

**Code sketch**:
```ts
await upsertSupplier(db, { id: 1, name: "Test Supplier" });
const supplier = await getSupplierDetails(db, 1);
expect(supplier.underdelivery_policy).toBe(0);
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> check if there already is a test with creating supplier with minimal fields
>

---

### 5. upsertSupplier should update supplier underdelivery_policy

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/suppliers-publishers.test.ts`
- **Category**: 🆕 New Functionality

**Rationale**: Verify supplier underdelivery policy can be updated

**Setup (Arrange)**:
Create supplier with underdelivery_policy=0

**Action (Act)**:
Call upsertSupplier with underdelivery_policy=1

**Assertion (Assert)**:
Verify supplier underdelivery_policy updated to 1

**Code sketch**:
```ts
await upsertSupplier(db, { id: 1, name: "Test Supplier", underdelivery_policy: 0 });
await upsertSupplier(db, { id: 1, underdelivery_policy: 1 });
const supplier = await getSupplierDetails(db, 1);
expect(supplier.underdelivery_policy).toBe(1);
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> check if there's a general test testing all supplier updated, if not "approve"
>

---

### 6. getPlacedSupplierOrders should include parent_order_id for continuation orders

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/supplier-order.test.ts`
- **Category**: 🆕 New Functionality

**Rationale**: Verify continuation orders are linked to parent orders

**Setup (Arrange)**:
Create supplier order and reconciliation that creates continuation order

**Action (Act)**:
Call getPlacedSupplierOrders

**Assertion (Assert)**:
Verify continuation order has parent_order_id set to original order id

**Code sketch**:
```ts
// Setup: create supplier with queue policy, underdeliver, finalize
// Then:
const orders = await getPlacedSupplierOrders(db);
const continuationOrder = orders.find(o => o.parent_order_id !== null);
expect(continuationOrder.parent_order_id).toBe(originalOrderId);
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> approve
>

---

### 7. finalizeReconciliationOrder should handle mixed underdelivery policies across multiple supplier orders

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🔲 Edge Case

**Rationale**: Verify correct behavior when reconciling multiple supplier orders with different policies

**Setup (Arrange)**:
Create supplier1 with pending policy, supplier2 with queue policy. Create orders for both. Reconcile with underdelivery for both.

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify supplier1 underdelivered lines rejected (placed=NULL). Verify supplier2 continuation order created. Verify customer orders handled correctly per policy.

**Code sketch**:
```ts
const supplier1 = { id: 1, name: "Pending Supplier", underdelivery_policy: 0 };
const supplier2 = { id: 2, name: "Queue Supplier", underdelivery_policy: 1 };
await upsertSupplier(db, supplier1);
await upsertSupplier(db, supplier2);
// Create orders and reconcile with underdelivery
// Verify mixed behavior
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> approve
>

---

### 8. finalizeReconciliationOrder should handle complete underdelivery (nothing delivered) with pending policy

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🔲 Edge Case

**Rationale**: Verify behavior when supplier delivers nothing with pending policy

**Setup (Arrange)**:
Create supplier with pending policy. Place order for 3 copies. Reconcile with 0 copies delivered.

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify all 3 customer order lines rejected (placed=NULL). Verify no lines marked as received.

**Code sketch**:
```ts
const supplier = { id: 1, name: "Test Supplier", underdelivery_policy: 0 };
await upsertSupplier(db, supplier);
await addBooksToCustomer(db, 1, ["1", "1", "1"]);
await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 3, supplier_id: 1 }]);
await createReconciliationOrder(db, 1, [1]);
await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 0 }]);
await finalizeReconciliationOrder(db, 1);
const lines = await getCustomerOrderLines(db, 1);
expect(lines.every(l => l.placed === null && l.received === undefined)).toBe(true);
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> approve
>

---

### 9. finalizeReconciliationOrder should handle complete underdelivery (nothing delivered) with queue policy

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🔲 Edge Case

**Rationale**: Verify behavior when supplier delivers nothing with queue policy

**Setup (Arrange)**:
Create supplier with queue policy. Place order for 3 copies. Reconcile with 0 copies delivered.

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify all 3 customer order lines remain placed. Verify continuation order created with 3 copies.

**Code sketch**:
```ts
const supplier = { id: 1, name: "Test Supplier", underdelivery_policy: 1 };
await upsertSupplier(db, supplier);
await addBooksToCustomer(db, 1, ["1", "1", "1"]);
await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 3, supplier_id: 1 }]);
await createReconciliationOrder(db, 1, [1]);
await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 0 }]);
await finalizeReconciliationOrder(db, 1);
const lines = await getCustomerOrderLines(db, 1);
expect(lines.every(l => l.placed !== null && l.received === undefined)).toBe(true);
const orders = await getPlacedSupplierOrders(db);
const continuationOrder = orders.find(o => o.parent_order_id === 1);
expect(continuationOrder.total_book_number).toBe(3);
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> approve
>

---

### 10. finalizeReconciliationOrder should handle overdelivery with underdelivery policy

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🔲 Edge Case

**Rationale**: Verify overdelivery behavior is not affected by underdelivery policy

**Setup (Arrange)**:
Create supplier with queue policy. Place order for 2 copies. Reconcile with 3 copies delivered (overdelivery).

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify 2 customer order lines marked as received. Verify 1 additional customer order line (if exists) marked as received. Verify no continuation order created (no underdelivery).

**Code sketch**:
```ts
const supplier = { id: 1, name: "Test Supplier", underdelivery_policy: 1 };
await upsertSupplier(db, supplier);
await addBooksToCustomer(db, 1, ["1", "1", "1"]);
await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
await createReconciliationOrder(db, 1, [1]);
await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 3 }]);
await finalizeReconciliationOrder(db, 1);
const lines = await getCustomerOrderLines(db, 1);
expect(lines.filter(l => l.received).length).toBe(3);
const orders = await getPlacedSupplierOrders(db);
const continuationOrders = orders.filter(o => o.parent_order_id !== null);
expect(continuationOrders.length).toBe(0);
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> skip
>

---

### 11. getCustomerOrderLinesCore should only return placed orders when status filter is eq

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/customer-orders.test.ts`
- **Category**: 🔄 Modified Behavior

**Rationale**: Verify bug fix - status filter changed from lte to eq to prevent pending orders from being included in reconciliation

**Setup (Arrange)**:
Create customer orders with different statuses (pending, placed, received)

**Action (Act)**:
Call getCustomerOrderLinesCore with status: { eq: OrderItemStatus.Placed }

**Assertion (Assert)**:
Verify only placed orders returned, not pending or received

**Code sketch**:
```ts
await addBooksToCustomer(db, 1, ["1", "2", "3"]);
// Mark one as placed
await db.exec("UPDATE customer_order_lines SET placed = ? WHERE isbn = ?", [Date.now(), "1"]);
// Mark one as received
await db.exec("UPDATE customer_order_lines SET received = ? WHERE isbn = ?", [Date.now(), "2"]);
const lines = await getCustomerOrderLinesCore(db, { customerId: 1, status: { eq: OrderItemStatus.Placed } });
expect(lines.length).toBe(1);
expect(lines[0].isbn).toBe("1");
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> skip
>

---

### 12. getCustomerOrderLinesCore should support orderBy parameter

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/customer-orders.test.ts`
- **Category**: 🔄 Modified Behavior

**Rationale**: Verify new orderBy parameter works correctly for different sort orders

**Setup (Arrange)**:
Create multiple customer order lines with different created timestamps

**Action (Act)**:
Call getCustomerOrderLinesCore with orderBy: "created ASC" and orderBy: "created DESC"

**Assertion (Assert)**:
Verify results are sorted correctly in both directions

**Code sketch**:
```ts
await addBooksToCustomer(db, 1, ["1", "2", "3"]);
const ascLines = await getCustomerOrderLinesCore(db, { customerId: 1, orderBy: "created ASC" });
const descLines = await getCustomerOrderLinesCore(db, { customerId: 1, orderBy: "created DESC" });
expect(ascLines[0].created.getTime()).toBeLessThan(ascLines[2].created.getTime());
expect(descLines[0].created.getTime()).toBeGreaterThan(descLines[2].created.getTime());
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> skip
>

---

### 13. finalizeReconciliationOrder should not execute DB updates when linesToDeliver is empty

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🔲 Edge Case

**Rationale**: Verify bug fix - length check prevents unnecessary DB operations with empty IN clauses

**Setup (Arrange)**:
Create reconciliation order with 0 copies delivered

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify reconciliation completes successfully without errors. Verify no customer order lines marked as received.

**Code sketch**:
```ts
await addBooksToCustomer(db, 1, ["1"]);
await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
await createReconciliationOrder(db, 1, [1]);
await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 0 }]);
await expect(finalizeReconciliationOrder(db, 1)).resolves.not.toThrow();
const lines = await getCustomerOrderLines(db, 1);
expect(lines[0].received).toBeUndefined();
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> small update: '(...) not execute delivery DB updates (...)'
>

---

### 14. finalizeReconciliationOrder should not execute DB updates when linesToReject is empty

- **File**: `apps/web-client/src/lib/db/cr-sqlite/__tests__/reconciliation-order.test.ts`
- **Category**: 🔲 Edge Case

**Rationale**: Verify bug fix - length check prevents unnecessary DB operations with empty IN clauses

**Setup (Arrange)**:
Create reconciliation order with exact delivery (no underdelivery)

**Action (Act)**:
Call finalizeReconciliationOrder

**Assertion (Assert)**:
Verify reconciliation completes successfully. Verify no customer order lines rejected.

**Code sketch**:
```ts
await addBooksToCustomer(db, 1, ["1"]);
await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
await createReconciliationOrder(db, 1, [1]);
await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);
await expect(finalizeReconciliationOrder(db, 1)).resolves.not.toThrow();
const lines = await getCustomerOrderLines(db, 1);
expect(lines[0].placed).not.toBeNull();
```

> 💬 **User comment**: *(write your feedback here — e.g. "approve", "skip", or a refinement)*
> small update: '(...) not execute rejection DB updates (...)'
>

---

## Deduplication Notes

Reviewed all proposed tests against existing test suite:

1. **Underdelivery policy tests (pending/queue)** - NO existing tests cover this behavior. All new tests are needed.

2. **Supplier policy configuration tests** - NO existing tests verify underdelivery_policy field in suppliers. All new tests are needed.

3. **Continuation order tests** - NO existing tests verify continuation order creation or parent-child relationships. All new tests are needed.

4. **getCustomerOrderLinesCore orderBy test** - NO existing tests verify the new orderBy parameter. New test needed.

5. **getCustomerOrderLinesCore status filter test** - NO existing tests verify the status filter behavior change from lte to eq. New test needed.

6. **Empty array length check tests** - These verify bug fixes. While existing tests may pass through these code paths, they don't explicitly verify the length check behavior. New tests are valuable to ensure the fix works correctly.

No duplicates found. All proposed tests add unique coverage for new or modified behavior.

