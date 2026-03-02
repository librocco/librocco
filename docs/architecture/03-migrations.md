# Migrations: Hash-Based Schema Evolution

Librocco uses a hash-based migration system rather than numbered migration files. There is one canonical schema definition, and the system detects changes by comparing a hash of the current schema content against the stored hash in the database.

## The Schema File

```
apps/web-client/src/lib/schemas/init
```

This file (no extension -- intentional, to work with the sync server's file resolution) contains all `CREATE TABLE IF NOT EXISTS` statements followed by `SELECT crsql_as_crr(...)` calls. It defines 13 tables:

| Table | Purpose | CRR? |
|-------|---------|------|
| `customer` | Customer records | Yes |
| `customer_order_lines` | Books ordered by customers | Yes |
| `book` | Book catalog (ISBN-keyed) | Yes |
| `supplier` | Supplier contacts | Yes |
| `supplier_publisher` | Publisher-to-supplier mapping | Yes |
| `supplier_order` | Orders to suppliers | Yes |
| `supplier_order_line` | Line items in supplier orders | Yes |
| `reconciliation_order` | Stock reconciliation records | Yes |
| `reconciliation_order_lines` | Line items in reconciliation | Yes |
| `customer_order_line_supplier_order` | Links customer orders to supplier orders | Yes |
| `warehouse` | Physical storage locations | Yes |
| `note` | Inbound/outbound/reconciliation notes | Yes |
| `book_transaction` | Book movements (the core of inventory) | Yes |
| `custom_item` | Non-book items on notes | Yes |

Every single table is a CRR (Conflict-free Replicated Record). See [05-crdt-conflict-resolution.md](./05-crdt-conflict-resolution.md).

### Foreign Keys Are Commented Out

```sql
-- apps/web-client/src/lib/schemas/init:34-35
PRIMARY KEY (id)
-- FOREIGN KEY (customer_id) REFERENCES customer(id) ON UPDATE CASCADE ON DELETE CASCADE,
-- FOREIGN KEY (isbn) REFERENCES book(isbn) ON UPDATE CASCADE ON DELETE CASCADE
```

cr-sqlite forbids checked foreign key constraints on CRR tables. The rationale: during replication, rows may arrive out of order (a child before its parent), which would violate foreign key constraints even though the data is eventually consistent. The would-be foreign keys are documented as comments, and the corresponding indexes are created manually.

This has real consequences. See [05-crdt-conflict-resolution.md](./05-crdt-conflict-resolution.md) and [06-known-issues.md](./06-known-issues.md).

## Version Tracking

```
apps/web-client/src/lib/db/cr-sqlite/db.ts:1-12
```

```typescript
import schemaContent from "$lib/schemas/init?raw";
export const schemaName = "init";
export const schemaVersion = cryb64(schemaContent);
```

The schema version is a CRC-64 hash of the raw file content. Any change -- even whitespace -- produces a new version. The name and version are stored in `crsql_master`:

```sql
INSERT OR REPLACE INTO crsql_master (key, value) VALUES ('schema_name', 'init');
INSERT OR REPLACE INTO crsql_master (key, value) VALUES ('schema_version', <hash>);
```

At startup, `getSchemaNameAndVersion()` (db.ts:14-24) reads these values and compares:

```
apps/web-client/src/lib/app/db.ts:140-167
```

- **No stored schema** -> fresh DB, apply schema
- **Name and version match** -> nothing to do
- **Mismatch** -> auto-migrate

## The Auto-Migration System

```
apps/web-client/src/lib/db/cr-sqlite/debug/migrations.ts
```

This is a JavaScript port of cr-sqlite's Rust `crsql_automigrate` function. It exists because the WASM build doesn't expose the Rust automigrate directly in all configurations.

### Entry Point: `jsAutomigrateTo()`

```typescript
// migrations.ts:80-128
export async function jsAutomigrateTo(db, schemaName, schemaContent): Promise<"noop" | "apply" | "migrate">
```

Returns:
- `"noop"` -- version matches
- `"apply"` -- no schema stored yet (first init)
- `"migrate"` -- version mismatch, migration needed

### Migration Flow

When migration is needed (`"migrate"` path):

1. **Strip CRR statements** from the schema (`strip_crr_statements`, lines 256-261)
   - Removes lines containing `crsql_as_crr` or `crsql_fract_as_ordered`
   - Reason: the migration creates a temporary in-memory database to compute the diff, and you can't load the cr-sqlite extension inside an already-running cr-sqlite instance

2. **Create an in-memory temp DB** (line 160)
   - Apply the stripped schema to it
   - This represents the "target" state

3. **Diff the schemas** via `migrate_to()` (lines 210-239)
   - Compare table lists between local DB and temp DB
   - Drop tables that no longer exist
   - For each existing table, call `maybe_modify_table()`

4. **Modify tables** via `maybe_modify_table()` (lines 280-317)
   - Compare columns between local and temp
   - For CRDT tables: wrap changes in `SELECT crsql_begin_alter(?)` / `SELECT crsql_commit_alter(?)` (lines 305, 313)
   - Drop removed columns
   - Add new columns
   - Update indexes

5. **Re-apply full schema** including CRR statements (line 199)

6. **Update version** in `crsql_master`

### CRDT Table Detection

The `is_crr()` function (lines 322-330) detects CRDT tables by checking for the presence of a trigger named `{table}__crsql_itrig`:

```sql
SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name = ?
```

### Transaction Safety

The entire migration is wrapped in `SAVEPOINT automigrate_tables` (line 178 of db.ts) so it can be rolled back if anything fails. A failed migration transitions the app to `AppDbState.Error`, which shows an error on the splash screen with a "Reset Database" button.

## The `Migrating` State

When `initializeDb()` detects a schema mismatch, it:

1. Sets `AppDbState.Migrating` (db.ts:170) -- the splash screen updates to "Migrating the database"
2. Calls `db.automigrateTo(schemaName, schemaContent)` (db.ts:177)
3. On success: transitions to `Ready`
4. On failure: transitions to `Error` with `ErrDBCorrupted`

The same flow applies to the demo DB initialization in `initializeDemoDb()` (db.ts:237-247).

## Key Insight: Schema Idempotency

All schema statements use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. This is essential because:
- The schema file is applied in full on first initialization
- During migration, the full schema (including CRR statements) is re-applied after column modifications
- The `IF NOT EXISTS` ensures this is always safe

## Key Files

| File | Purpose |
|------|---------|
| `apps/web-client/src/lib/schemas/init` | Canonical schema definition |
| `apps/web-client/src/lib/db/cr-sqlite/db.ts` | Schema version hashing, `getSchemaNameAndVersion()` |
| `apps/web-client/src/lib/app/db.ts` | `initializeDb()` migration check and state transitions |
| `apps/web-client/src/lib/db/cr-sqlite/debug/migrations.ts` | Full auto-migration implementation |
