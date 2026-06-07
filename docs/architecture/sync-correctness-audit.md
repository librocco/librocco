# Sync-correctness audit (warehouse domain + general architecture)

_Scope: the cr-sqlite / vlcn sync stack and the **warehouse-management** domain (warehouses,
notes, `book_transaction` legs, derived stock, the stock cache, bootstrap, transport, server).
Customer-order and supplier-order domains are deliberately out of scope._

_Assumptions baked into severity: the app is **normally always connected** to the central sync
server; **non-contentious** offline work is allowed (operators coordinate so two disconnected
nodes don't edit the same shared row). A bug that needs deliberate contentious offline edits of
the same row is **low** priority; a bug that bites **while connected** or on a **normal
reconnect/bootstrap** is **high**._

## How this was produced & how to read confidence

A multi-agent audit mapped six subsystems, hunted across six failure-mode lenses, deduped to 21
candidate findings, and adversarially verified them (the verification pass and final synthesis were
cut short by a session limit, so some findings have partial machine-verification). On top of that,
**the top tier below was verified by hand against the actual source** — those are marked
`code-verified`. Findings that rest mainly on agent analysis are marked `analysis` and flagged where
a human should confirm.

The unifying defect is **silent divergence**: workstations end up showing different stock with no
error surfaced. That is the exact family as the recently-fixed `OutboundStream.reset()` stub
(`3rd-party/js` commit `e99c5d7`). This audit found that the fix covered only **one of the two
directions** of gap recovery.

---

## Executive summary

The architecture itself is sound: CRDT local-first nodes behind a single relay server is a
reasonable design for this shop, and the CRDT layer (cr-sqlite) converges the underlying rows
correctly in the cases tested. **There is no need to re-architect.**

However, there is a recurring **systemic** mistake — *deriving correctness from things that are not
CRDTs*:

1. **Gap recovery on the upload path is dead code** (two critical bugs) — the same class as the bug
   you just fixed, but on the client→server direction, which is how each workstation's committed
   notes reach everyone else. A single skipped upload frame (routine on reconnect / backpressure)
   permanently loses a committed note storewide.
2. **Derived stock is decoupled from CRDT convergence** — the stock cache decides "did anything
   change?" using a **cross-node wall clock**, so synced-in commits silently fail to refresh it; and
   warehouse/note **deletes are plain SQL `DELETE`s**, which are not CRDT-safe and leave phantom /
   orphan stock after a concurrent insert on another node.
3. **Lifecycle & operational gaps** — multi-tab leadership hand-off, an unauthenticated
   user-editable room name, and a WAL-mode bootstrap snapshot can each silently split or stale a
   workstation behind a green "synced" badge.

The throughline of *why these shipped*: **the gap-recovery and convergence paths had almost no
tests.** The two engine bugs below would each have been caught by a ten-line unit test of the stream
classes; the derived-data bugs by a two-node convergence test asserting `stock == ground-truth SUM`.
See the companion skills `sync-convergence-test` and `sync-engine-regression-test`.

---

## Tier 1 — Critical: upload-path gap recovery is dead (the bug class you're fixing)

> The fixed `OutboundStream.reset()` repaired the **server→client** (download) direction. The
> **client→server** (upload) direction — which carries each workstation's writes to all others — is
> still broken in two independent places, and they compound.

### C1 — Server `InboundStream` applies a gapped changeset and advances its cursor past the gap `[code-verified]`
- **Where:** `3rd-party/js/packages/ws-server/src/streams/InboundStream.ts:47-66`
- The contiguity check sends `rejectChanges(...)` but has **no `return`**, so it falls through to
  `applyChangesetAndSetLastSeen` (line 60) and sets `#lastSeen = newLastSeen` (line 66) — applying a
  non-contiguous batch and **durably advancing the per-peer cursor (`crsql_tracked_peers`) past the
  missing range.** The client version (`ws-client/.../InboundStream.ts:43-50`) has the `return;`
  *and* a try/catch that reverts `#lastSeens` on apply failure — the server has neither.
- **Effect:** once the cursor jumps the gap, the server never re-requests the missing range — not
  even on reconnect (it offers `since = getLastSeen` = the advanced cursor). The missing committed
  note's legs are permanently absent from the canonical DB and therefore from every other
  workstation. Only a full nuke-and-resync of the origin node re-uploads them.
- **Fix:** add `return;` after `rejectChanges`; set `#lastSeen` *before* the await and revert in a
  `catch` (mirror the client). Plus serialize per-connection apply (see C3).

### C2 — Client cannot process an incoming `RejectChanges`; it `throw`s `[code-verified]`
- **Where:** `3rd-party/js/packages/ws-client/src/transport/WebSocketTransport.ts:71-74` —
  `case tags.RejectChanges: throw new Error("Unexpected event")`. `SyncedDB` wires only
  `onStartStreaming` / `onResetStream`; there is **no path from an inbound `RejectChanges` to the
  client's `OutboundStream.reset`.**
- **Effect:** when the server (correctly, post-fix) detects a gap in a client's upload and asks it to
  rewind and re-send, the client crashes that message instead. The client's `OutboundStream`
  `#lastSent` is never rewound; the missing range is never re-sent. **Client→server gap recovery is
  structurally absent.** (Note: server→client *download* recovery works — `OutboundStream.reset` is
  fixed and `ConnectionBroker` routes the client's reject to `syncConn.changesRejected`. It is only
  the reverse direction that is dead.)
- **Fix:** dispatch `tags.RejectChanges` on the client to a new `onReject` handler wired in
  `SyncedDB` to the client `OutboundStream` so it sets `#lastSent = msg.since` and re-pumps —
  mirroring the server's `SyncConnection.changesRejected → OutboundStream.reset` path.

> **C1 + C2 together** mean *any* gap in a client's upload stream is unrecoverable. Gaps form
> routinely: `sendChanges` returns `"reconnecting"` / `"buffer-full"` under backpressure, and a
> half-open socket reports `readyState === OPEN` while frames are dropped. This is the most likely
> real cause of "workstations out of sync" beyond the one already fixed.

### C3 — Server inbound apply is not serialized per connection, manufacturing false gaps `[analysis — plausible, confirm]`
- **Where:** `ws-server/src/streams/InboundStream.ts:60,66` (cursor set *after* the await) +
  `ConnectionBroker.ts:30-40` (async `ws.on("message")` with no per-connection queue).
- Two back-to-back `Changes` from one busy workstation can interleave: message 2's contiguity check
  reads a stale `#lastSeen` (message 1 hasn't reached line 66 yet) → spurious `RejectChanges` and,
  via C1's missing `return`, applies anyway; message 1 then moves `#lastSeen` *backward*. On a stable
  link the merges are idempotent and self-heal, **but a real lost-frame gap during this churn is
  indistinguishable from the false ones and gets swallowed** — amplifying C1.
- **Fix:** serialize per-connection inbound apply (a promise chain), and set `#lastSeen` before the
  await with a revert-on-error.

---

## Tier 2 — High: derived stock decoupled from CRDT convergence (warehouse domain, while connected)

### H1 — Stock cache invalidation keyed on a cross-node wall clock → permanently stale stock `[code-verified]`
- **Where:** `apps/web-client/src/lib/db/cr-sqlite/stock_cache.ts:16-22,84-88,97-102`. The cache
  refreshes only when `COUNT(*) FROM book_transaction WHERE committed_at > cacheTimestamp` is `> 0`,
  where `cacheTimestamp = MAX(committed_at)`. **`committed_at` is a per-node `Date.now()`**
  (`note.ts:484-491`) applied verbatim on receivers.
- **Effect (all while connected, no contention):**
  - *Clock skew / ordering:* node B (clock behind, or simply committing earlier in real time) commits
    50 books; its legs carry `committed_at < cacheTimestamp` on node A → `COUNT = 0` → cache never
    invalidates → A permanently omits B's 50 books.
  - *Late arrival after reconnect (no skew needed):* B commits a **reconciliation** correction at T1,
    briefly disconnects; A commits at T2 > T1 and caches T2; B reconnects, replays legs with
    `committed_at = T1 ≤ T2` → never invalidates. The exact tool used to fix wrong physical counts
    silently fails on the workstation that needs it.
  - *Non-atomic capture (variant):* `execQuery` reads stock (line 17) and `MAX(committed_at)` (line
    18) in two separate round-trips; a commit landing between them is pinned at the watermark and
    never invalidates.
- The CRR rows converge fine; only the **derived cached stock** is wrong, with no error, until reload
  or nuke.
- **Fix:** don't use `committed_at` as a change detector. Track a **local `crsql_db_version`
  watermark** at cache time and invalidate when `crsql_changes` for `book_transaction`/`note` exceed
  it (db_version is locally monotonic and bumps on every applied remote change) — or just invalidate
  unconditionally on the relevant `onRange` (recompute is already gated by cache activity).

### H2 — Stock cache ignores `note.committed` flips and warehouse deletions `[code-verified — SQL asymmetry]`
- **Where:** invalidation subscribes to `onRange(["book_transaction"])` only
  (`routes/+layout.svelte:235`), but the stock SUM gates on `n.committed = 1` (`stock.ts:116`) and
  `LEFT JOIN warehouse` (`stock.ts:118`). So a peer committing a draft note (committed 0→1, with leg
  `committed_at` possibly ≤ the watermark per H1) or deleting a warehouse changes derived stock but
  is **not in the watched table set** and/or doesn't bump the watermark.
- **Fix:** add `"note"` and `"warehouse"` to the `onRange` list and adopt the db_version gate from H1.

### H3 — `deleteWarehouse` leaves permanent phantom stock after a concurrent commit `[code-verified — mechanism]`
- **Where:** `apps/web-client/src/lib/db/cr-sqlite/warehouse.ts:167-186` (snapshot-time
  `DELETE`/`UPDATE`); `stock.ts:118` (`LEFT JOIN warehouse`). No FKs (commented out in `schemas/init`).
- **Scenario (two connected operators, different notes — non-contentious):** B creates & commits a
  fresh inbound note into warehouse X (brand-new `book_transaction` PKs A has never seen).
  Concurrently A deletes warehouse X — but `deleteWarehouse` only touches rows in A's *local snapshot*,
  so it never tombstones B's unseen legs. On merge: the warehouse-row delete wins (gone on both
  nodes), but B's legs are fresh inserts with no conflicting local row → they survive on both nodes.
  Final state: **committed legs pointing at a warehouse row that no longer exists.** `stock.ts`
  `LEFT JOIN`s warehouse and sums them as **phantom positive stock with a blank warehouse name**,
  while the warehouse *list* omits X — the two views disagree on every node, and outbound sales can
  validate against this ghost stock. Requires nuke to clear.
- **Fix:** `deleteWarehouse` can't be made CRDT-safe by snapshot `DELETE`s alone. Prefer **soft
  delete** (keep the row with a `deleted` flag; `stock.ts` / out-of-stock checks exclude soft-deleted
  warehouses so late legs are neutralized deterministically on every node), or `INNER JOIN warehouse`
  in `stock.ts` so a missing warehouse row can never contribute stock.

### H4 — `deleteNote` orphan leg inflates warehouse-list totals `[code-verified — SQL asymmetry]`
- **Where:** `note.ts:502-513` (delete note + legs by `note_id`) vs `warehouse.ts:117-124`
  (`totalBooks` LEFT JOINs note and counts when `n.committed = 1 OR n.committed IS NULL`).
- Same resurrection mechanism as H3: A deletes draft note N while B adds a new leg to N. After
  convergence an **orphan leg** (no note row) survives. `stock.ts` INNER JOINs note so the **stock
  page** correctly ignores it — but the **warehouse list** counts it (the `n.committed IS NULL` branch
  is exactly what catches orphans), so the two views permanently disagree.
- **Fix:** make `warehouse.ts` totals consistent with `stock.ts`: INNER JOIN note, gate on
  `n.committed = 1` only. Optionally add an orphan-leg sweep.

### H5 — `updateNoteTxn` DELETE+INSERT PK-rewrite resurrects a leg and drops `committed_at` `[analysis — confirm]`
- **Where:** `note.ts:667-681` (the INSERT column list omits `committed_at`); commit guard reads local
  snapshot (`note.ts:640-644`).
- In the normal sync-lag window after A commits note N but before B sees the commit, B edits the same
  line via the DELETE+INSERT PK rewrite (it still looks draft on B). The resurrected leg wins on
  merge, lands with `quantity = Q_B` and `committed_at = NULL` on a note that is `committed = 1`. Stock
  counts the wrong quantity, and `committed_at = NULL` means H1's cache may never recompute it.
- **Fix:** for a same-warehouse quantity change, do a plain `UPDATE` of the LWW `quantity` column
  (no PK rewrite). Where the PK rewrite is genuinely needed (warehouse change), carry `committed_at`
  forward. Treat commit as a barrier.

---

## Tier 3 — High/medium: lifecycle, multi-tab & operational

| ID | Finding | Where | Confidence |
|----|---------|-------|-----------|
| L1 | **Leader-tab close permanently stops sync on the surviving tab**, and the connectivity monitor latches "connected" so auto-recovery never fires (`onProviderChange` has zero subscribers). | `core/worker-db.ts:72-162`; `stores/app.ts:104`; `+layout.svelte:132-187` | analysis — high impact, confirm |
| L2 | **Nuke/resync (or DB select/delete) from a follower tab closes & deletes the shared DB for ALL tabs** — and the nuke dialog is the app's headline "fix sync" action. | `lib/app/index.ts:33-115` | analysis — high impact, confirm |
| L3 | Per-tab `stopSync`/`startSync` and the `syncActive` toggle drive the single machine-global runtime, so one tab can silently stop sync for another. | `core/worker-db.worker.ts`; `+layout.svelte:198-200` | analysis |
| L4 | **Unauthenticated, user-editable room name (`dbid`)**: a typo silently splits a workstation onto a different/empty server DB (auto-created) while showing "synced". | `apps/sync-server/src/index.ts` (noopAuth, auto-create room); `routes/settings/+page.svelte` | code-verified (no auth, auto-create) |
| L5 | **`/file` bootstrap snapshot served raw in WAL mode** (no checkpoint / read-tx / backup); client strips the WAL header → a nuked/bootstrapped node can start missing the latest commits and record the gap as already-seen. | `apps/sync-server/src/index.ts:266-273`; `core/utils.ts` (header flip, reidentify) | code-verified (raw `sendFile`, WAL) |
| L6 | OPFS `move()` fallback opens dest without `{create:true}` after deleting it → restore/bootstrap swap fails on **non-Chromium** (iOS Safari/Firefox), destroying the local DB. | `core/utils.ts:204-224` (line 217) | analysis — confirm on target browsers |
| L7 | **Receive-only workstation has no liveness check**: a silent inbound stall (socket stays open) self-reports "synced" and never auto-recovers (all recovery is keyed on pending writes or an observed socket close). | `stores/app.ts:104`; `+layout.svelte:156-163` | analysis |
| L8 | On Linux prod, peer change fan-out depends solely on chokidar mtime polling (`touchHack` is a no-op off macOS/Windows); a missed/late WAL-mtime event silently stops a connected viewer from receiving committed changes. | `3rd-party/js .../ws-server/src` (`DB`, `fs/touchHack`, `fs/FSNotify`) | analysis — confirm on prod config |

---

## Tier 4 — Architectural posture ("are we missing a big mistake?")

Honest answer: **no fundamental re-architecture is warranted**, but four design choices set the
ceiling on reliability and deserve explicit decisions/tests.

- **A1 — Cursor isn't `seq`-aware end-to-end.** The server pulls with strict `db_version > since` and
  forces `seq = 0`. After a fleet-wide nuke, many nodes restart from the **same** `db_version`
  baseline (reidentify seeds `tracked_peers = MAX(db_version)`), so two nodes' first post-bootstrap
  writes collide at the same `db_version` under different `site_id`s, and one can be permanently
  skipped. (`core/utils.ts` reidentify; server `OutboundStream`.) _Latent; routine after bootstrap._
- **A2 — Single 127.0.0.1 server is a SPOF**, and `performStartupHealthCheck` exits the **whole**
  process on any one room's integrity failure (one bad room blocks all rooms). Post-outage
  convergence rests entirely on the (now-known-fragile) cursor/gap-recovery code.
  _Fix: per-room quarantine, supervised restart, consistent backups, and a tested
  reconnect-after-outage path._
- **A3 — Schema versioning by file-hash is all-or-nothing.** A rolling client deploy whose hash
  differs from the server's on-disk schema causes a reject/reconnect storm (looks like a flaky
  connection, no "upgrade required" message), and a destructive `crsql_automigrate` can DROP
  columns/tables on the shared canonical DB. _Fix: single generated schema source verified in CI;
  gate destructive migrations; emit a real `schema_mismatch` status before closing._
- **A4 — Wall-clock columns used as truth.** `committed_at` / `updated_at` / `last_bubbled_up` are
  unsynchronized per-node clocks but are used for cache invalidation (H1), list ordering, and more.
  Treat them as best-effort display only; never derive correctness or cross-node ordering from them.

---

## Recommended priority order

1. **C1 + C2** (and C3) — restore upload-path gap recovery. Small, surgical, highest impact; add the
   engine regression tests first so the fix is locked in.
2. **H1 + H2** — make stock-cache invalidation logical-version based, not wall-clock; watch `note` &
   `warehouse`. Cheap, removes the dominant silent-stale-stock vector.
3. **H3 + H4** — soft-delete warehouses (or INNER JOIN) and align the warehouse-total query with
   `stock.ts`. Removes phantom/orphan stock.
4. **L2, L1, L4, L5** — lifecycle & operational: guard destructive ops to the leader tab; wire
   `onProviderChange`; authenticate/whitelist rooms; checkpoint before `/file`.
5. **H5, L3/L6/L7/L8, A1–A4** — harden.

## Notable non-issues (so they're not chased)

- The CRDT layer itself converges row state correctly; LWW-per-column and causal-length deletes
  behave as documented (verified against `deps/cr-sqlite/core/rs/core/src`). The problems are in code
  that sits *around* the CRDT, not in the CRDT.
- The server→client (download) gap recovery is now correct (post the `OutboundStream.reset` fix +
  `ConnectionBroker` routing). Only the upload direction is broken.
- Several "scary" clock-skew effects are display-ordering only (e.g. note list order) — consistent
  across nodes, not divergent.

## Tests that would have caught all of this

See the two skills added alongside this audit:

- **`sync-convergence-test`** — app-level multi-node convergence + derived-invariant tests (catches
  H1–H5, the resurrection/phantom/orphan and stale-cache classes).
- **`sync-engine-regression-test`** — protocol/stream regression tests against the installed vlcn
  tarball (catches C1–C3 and the cursor classes; the existing `OutboundStream`/peer-coherence tests
  are the template).
