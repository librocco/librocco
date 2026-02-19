# CRDT Conflict Resolution: How cr-sqlite Merges Data

This document explains how cr-sqlite resolves conflicts when two clients modify data concurrently.

**The fundamental guarantee:** After bidirectional sync completes, all databases converge to identical state. This is unconditional -- it holds regardless of operation ordering, network interruptions, or concurrent modifications. cr-sqlite's CRDT math ensures deterministic convergence. If two browsers show different data, the problem is either that sync hasn't finished yet, or that the UI isn't reflecting what the database already knows.

## What cr-sqlite Does

cr-sqlite turns ordinary SQLite tables into **Conflict-free Replicated Records (CRRs)**. When you call:

```sql
SELECT crsql_as_crr('note');
```

cr-sqlite creates hidden metadata tables and triggers that track every column-level change with:
- A **column version** (`col_version`) -- a per-cell logical clock
- A **database version** (`db_version`) -- a per-database logical clock
- A **site ID** -- a unique identifier for the database instance
- A **causal length** (`cl`) -- how many predecessor changes led to this one

## Last-Write-Wins (LWW) per Cell

The core conflict resolution strategy is **Last-Write-Wins at the column level**. Not at the row level -- at the *column* level.

Example: Two clients update the same customer row concurrently.

| Client A | Client B |
|----------|----------|
| `UPDATE customer SET fullname = 'Alice' WHERE id = 1` | `UPDATE customer SET email = 'bob@x.com' WHERE id = 1` |

After sync, the result is `fullname = 'Alice'` AND `email = 'bob@x.com'`. There's no conflict because different columns were modified. Each column has its own version clock.

If both clients modify the *same* column, the one with the higher `col_version` wins. If versions are equal, the `site_id` is used as a tiebreaker (lexicographic comparison of UUIDs). This is deterministic: every client will arrive at the same result regardless of the order changes are applied.

## The `crsql_changes` Virtual Table

```
apps/web-client/src/lib/db/cr-sqlite/db.ts:47-63
```

All changes are exchanged through the `crsql_changes` virtual table. A single change represents one cell modification:

```typescript
type Change = readonly [
    TableName,      // "book_transaction"
    PackedPks,      // Primary key(s), packed into a binary format
    CID,            // Column ID (column name, e.g., "quantity")
    Val,            // New value
    col_version,    // How many times this specific cell has been written
    db_version,     // Logical clock of the database at time of write
    site_id,        // UUID of the originating database
    cl,             // Causal length
    seq             // Sequence within a transaction
];
```

### Reading Local Changes

```typescript
const getChanges = (db, since) => {
    return db.execA(`
        SELECT "table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"
        FROM crsql_changes
        WHERE db_version > ? AND site_id = crsql_site_id()
    `, [since]);
};
```

Note: `site_id = crsql_site_id()` filters to only local changes. The sync layer tracks "since" cursors per peer to avoid re-sending.

### Applying Remote Changes

```typescript
const applyChanges = async (db, changes) => {
    for (const change of changes) {
        await db.exec(`
            INSERT INTO crsql_changes
                ("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, change);
    }
};
```

When you `INSERT INTO crsql_changes`, cr-sqlite doesn't blindly overwrite. It compares the incoming `col_version` with the stored one and only applies the change if it wins the LWW comparison.

## Clock Tables

cr-sqlite creates hidden clock tables for each CRR:

- `{table}__crsql_clock` -- tracks the latest version for each (pk, column) pair
- `crsql_site_id` -- stores the local site ID and any known peer site IDs

The `crsql_tracked_peers` table records the last `db_version` seen from each peer, so the sync layer knows where to resume.

## What This Means for Librocco

### Every Table is a CRR

All 14 tables in the schema are activated as CRRs. This means:

1. **No foreign key enforcement** -- cr-sqlite prohibits checked foreign keys on CRRs. Rows can reference nonexistent parents. Indexes are created manually to approximate the query performance foreign keys would provide.

2. **Eventual consistency** -- every client will converge to the same state, but the path to convergence depends on the order changes arrive.

3. **No transactions across tables at the sync level** -- SQLite transactions are local. When you `INSERT INTO note` and then `INSERT INTO book_transaction` in one local transaction, they ship as separate changes that may arrive at other clients at different times.

### The `book_transaction` Composite Key

```sql
-- schemas/init:164-176
CREATE TABLE IF NOT EXISTS book_transaction (
    isbn TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    note_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    committed_at INTEGER,
    last_bubbled_up INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (isbn, note_id, warehouse_id)
);
```

The primary key is `(isbn, note_id, warehouse_id)`. This is a composite key, meaning:

- `(isbn: "978-X", note_id: 42, warehouse_id: 1)` is one row
- `(isbn: "978-X", note_id: 42, warehouse_id: 2)` is a **different** row

Both can exist simultaneously. cr-sqlite treats them as independent entities that never conflict with each other (different PKs = different rows).

### Why Two Browsers Showed Different Books (UI Divergence, Not DB Divergence)

The observed bug -- same outbound note, different books in two browsers -- was **not** a cr-sqlite convergence failure. After sync completed, both databases contained identical data. The problem was that the UI didn't know the database had changed.

**What happened:**

1. Browser A adds isbn "978-A" to note 42. Browser B adds isbn "978-B" to note 42.
2. Sync runs. Both databases now contain both "978-A" and "978-B". cr-sqlite guarantees this.
3. **But the UI didn't re-query.** The sync worker applied changes to its database connection, but the main thread's `TblRx` was never notified. See [04-reactivity.md](./04-reactivity.md).
4. Browser A's UI still showed only "978-A". Browser B's UI still showed only "978-B". A page refresh on either browser would reveal both books.

The fix (`notifyAll()` in commit `b87fcd3c`) ensures the UI re-queries after sync changes arrive. The databases were always correct; the reactivity layer was the broken link.

### Semantic Surprises (Not Conflicts)

Even with convergence guaranteed, CRDTs can produce results that surprise application-level expectations. These aren't bugs -- they're consequences of the CRDT model:

**The note commit race:** When a note is committed (`commitNote()`), it sets `committed = 1` and `committed_at = now()`. If Browser A commits while Browser B's book addition hasn't synced yet, then after full sync completes, both databases will show: a committed note with a book transaction that has `committed_at = NULL`. Both databases agree on this state -- it's consistent, just semantically odd. The application didn't anticipate a book arriving after commit.

This is a business-logic gap, not a CRDT failure. CRDTs guarantee the databases match; they don't guarantee the result makes business sense. Handling this requires application-level guards (e.g., checking sync status before commit).

## Site ID Management

```
apps/web-client/src/lib/db/cr-sqlite/core/utils.ts:313-349
```

Each database instance has a unique site ID (a UUID stored as bytes). The `reidentifyDbNode()` function is called after initial sync (downloading a full DB snapshot):

```typescript
async function reidentifyDbNode(db: DBAsync) {
    await db.tx(async (txDb) => {
        await txDb.exec("DELETE FROM crsql_tracked_peers");
        await txDb.exec("DELETE FROM crsql_site_id WHERE ordinal != 0");
        await txDb.exec("UPDATE crsql_site_id SET ordinal = 1 WHERE ordinal = 0");

        const siteid = uuidV4Bytes();
        await txDb.exec(
            "INSERT INTO crsql_site_id (site_id, ordinal) VALUES (?, ?)",
            [siteid, 0]
        );

        // Mark all existing clock entries as from the server
        for (const [tbl] of crsql_clock_tables) {
            await txDb.exec(`UPDATE ${tbl} SET site_id = 1`);
        }
    });
}
```

This ensures:
- The client gets a fresh identity
- All pre-existing data is attributed to the server (ordinal 1)
- Future local changes are tracked under the new site ID

## Summary: What CRDTs Guarantee and What They Don't

**Guaranteed (unconditionally, after bidirectional sync completes):**
- **Database convergence:** all clients have identical database state
- **No data loss:** concurrent edits to different cells/rows are all preserved
- **Deterministic conflict resolution:** LWW with site ID tiebreaker produces the same winner on every client

**Not guaranteed (application-layer concerns):**
- Referential integrity: child rows can exist without parents (no checked FKs)
- Business rule enforcement: "a committed note contains exactly these books" is not expressible at the CRDT level
- Instant propagation: there's always a latency window where databases differ (sync in progress)
- UI consistency: the UI must be explicitly told to re-query after sync changes arrive (the `notifyAll()` fix)

## Key Files

| File | Purpose |
|------|---------|
| `apps/web-client/src/lib/schemas/init` | All CRR table definitions |
| `apps/web-client/src/lib/db/cr-sqlite/db.ts` | `getChanges()`, `applyChanges()`, `getSiteId()` |
| `apps/web-client/src/lib/db/cr-sqlite/core/utils.ts` | `reidentifyDbNode()`, clock table management |
| `apps/web-client/src/lib/db/cr-sqlite/note.ts` | Note operations, commit logic |
