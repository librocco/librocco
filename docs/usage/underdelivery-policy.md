# Underdelivery Policy

This document describes the behavior currently implemented in the app for supplier underdelivery handling.

## Policies

Each supplier has an `underdelivery_policy`:

- `0` (`pending`)
- `1` (`queue`)

If a policy is missing, the app defaults to `pending` (`COALESCE(..., 0)` in queries and joins).

## Where It Is Configured and Shown

- Supplier create/edit form includes an `Underdelivery policy` select with `pending` and `queue` options.
- Supplier card shows the current policy (`pending` or `queue`).
- Reconciliation Step 2 shows a per-order action badge derived from supplier policy.

Important: Step 2 currently **shows** the policy, but does not let the user override it in the flow.

## Reconciliation Finalization Behavior

On finalization, the system reads supplier order lines and supplier policy, compares them to the scanned delivered quantities, then:

1. marks delivered customer lines as received (`received = <timestamp>`), and
2. handles underdelivery according to policy.

### `pending` policy (`0`)

For underdelivered quantity, matching customer order lines are moved back to pending by setting:

- `placed = NULL`

This makes those lines eligible again in the "possible/unordered" supplier-order pipeline.

### `queue` policy (`1`)

For underdelivered quantity, customer lines stay placed (not rejected), and continuation supplier orders are created:

- one continuation order per parent supplier order,
- continuation lines include underdelivered ISBN/quantity,
- parent-child link is stored in `supplier_order_continuation`.

Placed supplier order queries include `parent_order_id`, so continuation orders can be identified.

## Practical Notes

- The policy used is the supplier policy at reconciliation finalization time (it is joined from `supplier` then), not snapshotted on the original placed supplier order.
- Continuation order IDs are currently generated with a temporary random ID strategy.
- Overdelivery is capped by ordered quantity during finalization; extra scanned quantity beyond that cap is ignored.

## Known Limitations

- No in-reconciliation policy override UI is active (display-only badge in Step 2).
- The current allocation logic is first-come-first-served by supplier order creation time and includes an in-code TODO for potential queue-policy edge-case consistency.

## Localization Status

- English includes labels for underdelivery policy.
- German and Italian JSON currently contain empty-string entries for these specific labels.
