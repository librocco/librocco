# Sync: User Requirements and Implementation Status

This document defines the user-facing requirements for sync behavior, analyzes the current implementation, identifies gaps, and provides recommendations for achieving the desired behavior. It serves as both a specification and a roadmap.

## User-Facing Requirements

From the user's perspective, the sync system should provide clear, reliable feedback about data safety:

### Requirement 1: Green Light = Server Changes Are Local

> If the user sees a green "Remote DB" light in the footer, any changes from more than one (or a few) seconds ago to the remote database on the sync server have already been synced to this browser.

**Implication**: The green light is a guarantee that the local database is up-to-date with the server, within a small time window.

### Requirement 2: Green Light = Local Changes Will Be Persisted

> If the user sees a green "Remote DB" light in the footer, any action done locally will (to the best of the software's knowledge) immediately be persisted to the sync server.

**Implication**: The green light means "it's safe to make changes -- they will be saved remotely". It's a promise that the sync channel is working in both directions.

### Requirement 3: Awareness of Pending Local Changes

> Librocco should be aware if there are any local changes that need to be pushed to the sync server but haven't been and can't be pushed right now. The footer should include info about it.

**Implication**: Users need to know when their work exists only locally, especially before closing the browser or during network issues.

### Requirement 4: Recovery from Unsyncable State

> In case the remote database is unsyncable (e.g., the server database was rebuilt after corruption), the user should be given the chance to "Nuke and Resync".

**Implication**: The system must detect incompatibility and offer a clear recovery path rather than silently failing or showing a misleading green light.

---

## Current Implementation State

### The Footer Component

**File**: `apps/web-client/src/lib/components/ExtensionStatusBanner.svelte`

The footer now shows a single "Remote DB" badge (the Book Data Extension badge has been removed). The badge color reflects the sync state (yellow while connecting, green when connected, red when disconnected or stuck), and it appends a pending count when there are unsent local changes:

```svelte
<div class="badge" data-status={$syncState.status}>
  <div class={indicatorClass}></div>
  <p>{`Remote DB${$syncState.pending ? ` (${$syncState.pending} pending)` : ''}`}</p>
</div>
```

**Current Behavior**: The indicator derives from `syncConnectivityMonitor` plus a pending-changes store that counts local `crsql_changes` rows newer than the last sent version (persisted per DB). Green means connected and no pending local changes.

### Connectivity Tracking

**File**: `apps/web-client/src/lib/stores/app.ts`

The `syncConnectivityMonitor` tracks:

- `connected`: Boolean, set `true` on WebSocket open, `false` on close
- `stuck`: Boolean, set `true` after 3 rapid connection failures or 10s timeout
- `diagnostics`: Object with failure reason and counts

```typescript
const unsubscribeOpen = worker?.onConnOpen(() => {
  _syncConnectivityMonitor.connected.set(true); // GREEN
  // ...
});

const unsubscribeClose = worker?.onConnClose(() => {
  _syncConnectivityMonitor.connected.set(false); // RED
  // ...
});
```

### Sync Progress Dialog

**File**: `apps/web-client/src/routes/+layout.svelte`

Shows during sync with a progress bar displaying `nProcessed/nTotal`:

```svelte
{tLayout.sync_dialog.description.progress({
  nProcessed: $syncProgress.nProcessed,
  nTotal: $syncProgress.nTotal
})}
```

### Sync Stuck Detection and Recovery

**Files**: `lib/stores/app.ts`, `routes/+layout.svelte`

When sync is detected as "stuck" (rapid connection failures or timeout), a dialog appears offering "Nuke and Resync" -- which deletes the local OPFS database and triggers re-download from the server.

### Sync Server File Watching (.sqlite3 fix)

**Files**: `3rd-party/js/packages/ws-server/src/fs/util.ts`, `3rd-party/js/packages/ws-server/src/fs/FSNotify.ts`, `apps/sync-server/src/index.ts`, `python-apps/launcher/launcher/config.py`

The `@vlcn.io/ws-server` FSNotify code now preserves file extensions when normalizing events (it previously dropped `.sqlite3`, breaking watch registration). We also:

- Proxy all `*.sqlite3` and `*.sqlite` HTTP endpoints through Caddy in the headless launcher so `/exec` and `/file` routes reach the sync server instead of 404-ing in CI.
- Turn on `notifyPolling` in dev
- Run `touchHack` after HTTP `/exec` mutations to force a watch event on the DB file

Remote-only changes now reach WebSocket clients for `.sqlite3` databases; the e2e sync suite runs without skips.

### Compatibility Handshake + UI

**Files**: `apps/sync-server/src/index.ts`, `apps/web-client/src/lib/stores/sync-compatibility.ts`, `apps/web-client/src/lib/app/sync.ts`, `apps/web-client/src/routes/+layout.svelte`, `apps/web-client/src/lib/components/ExtensionStatusBanner.svelte`

- The sync server exposes `/:dbname/meta` (site_id, schema_name, schema_version) and a dev-only `/:dbname/reset` endpoint (used by e2e to simulate remote rebuilds).
- The client fetches remote meta before starting live sync, compares schema_version to the local one, and remembers the remote site_id per DB. If the remote site_id changes (server rebuild) or meta is unreachable/missing, the footer shows an "incompatible" state and the stuck dialog prompts "Nuke and Resync".
- Compatibility resets when running "Nuke and Resync". An e2e test covers the rebuilt-DB flow.

---

## Gap Analysis

### Gap 1: "Connected" Doesn't Mean "Syncable"

**Mitigation now**: Before starting live sync we fetch `/:dbname/meta`, compare schema_version, and require the remote site_id to match the previously-seen site_id. On mismatch/unreachable/missing meta we surface an "incompatible" state and ask the user to "Nuke and Resync".

**Remaining risk**: The check relies on the HTTP meta endpoint; it's not yet part of the WebSocket protocol/handshake, so we'd miss incompatibility if the HTTP call is blocked while the WebSocket connects. Move the check into the transport protocol to close this gap fully.

### Gap 2: No Tracking of Pending Local Changes

**Current**: The footer shows pending counts based on local `crsql_changes` newer than the last sent db_version (persisted per DB). There is still no explicit server acknowledgment, so it assumes messages marked as "sent" were accepted.
**Required**: Footer should show when local changes haven't reached the server, ideally based on server acknowledgment rather than send-attempts.

**Why This Matters**:

- Users might close the browser thinking their changes are saved
- Network interruptions could cause silent data loss
- No way to know if "green light" means "all synced" or "connection open but queue full"

### Gap 3: Progress Numbers Are Meaningless

**Current**: Progress now reports change counts (number of CR-SQL change entries) instead of chunk counts, but it still lacks a notion of record size or time remaining.
**Required**: Progress should indicate actual data volume or time remaining; change counts are a step closer but not a full solution.

### Gap 4: No Validation of Sync Compatibility

**Current**: Connection opens → green light
**Required**: Connection opens + handshake validates compatibility → green light

**Missing Checks**:

1. Schema version match between client and server
2. Database identity validation (site_id lineage)
3. Successful initial data exchange confirmation

## Implementation Recommendations

### Recommendation 1: Implement Pending Changes Counter (Option A)

Use a periodic query of `crsql_changes` to count unsynced local changes.

**Approach**:

1. Track the last acknowledged server version for each peer
2. Query: `SELECT COUNT(*) FROM crsql_changes WHERE db_version > ?`
3. Update the footer to show: "Remote DB (3 pending)" or just the green light when 0

**Implementation Sketch**:

```typescript
// In lib/stores/app.ts or new file lib/stores/sync-pending.ts

export const pendingChangesCount = writable<number>(0);

export async function updatePendingChangesCount(db: DB) {
  const localVersion = await getDBVersion(db);
  const serverAckVersion = await getLastAcknowledgedVersion(db);

  const result = await db.execO<{ count: number }>(`SELECT COUNT(*) as count FROM crsql_changes WHERE db_version > ?`, [serverAckVersion]);

  pendingChangesCount.set(result[0]?.count ?? 0);
}
```

**Trade-offs**:

- **Pro**: Uses existing cr-sqlite mechanisms
- **Pro**: Works offline (shows accumulated pending changes)
- **Con**: Requires periodic polling or triggered updates
- **Con**: "Acknowledged version" concept needs definition (see Recommendation 4)

### Recommendation 2: Fix Progress Tracking to Show Record Counts

**Problem**: `nProcessed/nTotal` shows chunks, not records.

**Fix Approach**:

1. Track total records across all chunks:

   ```typescript
   enqueue({ changes, ... }: Changes) {
     this.#totalRecords += changes.length;  // Track actual record count
     for (const chunk of chunks(changes, this.#maxChunkSize)) {
       this.#queue.push({ ... });
     }
   }
   ```

2. Track processed records:

   ```typescript
   private _processQueue = async () => {
     while (i < this.#queue.length) {
       const chunk = this.#queue[i];
       this.#processedRecords += chunk.changes.length;

       this.onProgress?.({
         active: true,
         nProcessed: this.#processedRecords,
         nTotal: this.#totalRecords
       });
     }
   }
   ```

**Consideration**: For very large syncs, show byte-based progress or estimated time. Record counts can still be confusing if each record varies in size.

### Recommendation 3: Add Sync Handshake Validation

Before showing a green light, validate that sync is actually working:

1. **Schema Version Check**: Compare local schema hash with server's
2. **Identity Validation**: Verify the server recognizes this client's site_id
3. **Data Flow Test**: Confirm at least one successful round-trip

**Implementation Approach**:

Add a "validation" phase after WebSocket connect:

```typescript
// In SyncTransportController or sync-worker.ts

async validateSyncCompatibility(): Promise<{ compatible: boolean; reason?: string }> {
  // 1. Send a probe message
  // 2. Server responds with its schema version and known peers
  // 3. Compare with local state
  // 4. Return compatibility result
}
```

**Note**: This requires changes to the sync server protocol. Consider whether `@vlcn.io/ws-server` supports custom handshake messages or if a separate HTTP endpoint is needed.

**Alternative (Simpler)**: Detect incompatibility from sync failures:

- If changes are repeatedly rejected → mark as incompatible
- If connection closes immediately after sending changes → likely schema mismatch
- This is essentially what the "stuck detection" does, but could be made more specific

### Recommendation 4: Define "Acknowledged" vs "Sent"

Currently, there's no distinction between:

- Changes written locally (in `crsql_changes`)
- Changes sent over WebSocket
- Changes acknowledged by the server
- Changes confirmed as applied by the server

**For Pending Changes Tracking**:

Option A (Simple): Consider "sent" as "acknowledged"

- When the sync worker sends changes, assume they're delivered
- Track: `db_version > last_sent_version`
- Risk: Network failure after send means false "synced" state

Option B (Reliable): Implement server acknowledgment

- Server responds with "ACK" including the version it received
- Track: `db_version > last_ack_version`
- Requires protocol extension

**Recommendation**: Start with Option A for simplicity. The WebSocket protocol already ensures delivery at the transport level; losing changes would require connection failure during transmission, which would trigger reconnection and resend anyway.

### Recommendation 5: Footer State Machine

Define clear states for the sync indicator:

| State          | Visual            | Meaning                       |
| -------------- | ----------------- | ----------------------------- |
| `disconnected` | Red dot           | No connection to server       |
| `connecting`   | Yellow/pulsing    | Connection in progress        |
| `synced`       | Green dot         | Connected, 0 pending changes  |
| `syncing`      | Green dot + count | Connected, N pending changes  |
| `stuck`        | Red dot + warning | Connection failing repeatedly |
| `incompatible` | Red dot + error   | Server DB is incompatible     |

### Current Gaps After Recent Changes

- Progress events now surface and reflect record counts (changes) even when subscribers attach after completion; still no size/ETA.
- Pending-count logic is based on “last sent” only; no server ACK yet.
- The `.sqlite3` FSNotify fix is local to our vendored `@vlcn.io/ws-server`; upstreaming or pinning the patched build is still required to avoid regression on dependency updates.

**Implementation**:

```typescript
type SyncState =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'synced' }
  | { status: 'syncing'; pending: number }
  | { status: 'stuck'; diagnostics: SyncStuckDiagnostics }
  | { status: 'incompatible'; reason: string };

export const syncState = derived(
  [syncConnectivityMonitor.connected, syncConnectivityMonitor.stuck, pendingChangesCount],
  ([connected, stuck, pending]) => {
    if (stuck) return { status: 'stuck', diagnostics: ... };
    if (!connected) return { status: 'disconnected' };
    if (pending > 0) return { status: 'syncing', pending };
    return { status: 'synced' };
  }
);
```

---

## E2E Testing Requirements

Testing sync behavior is challenging because it involves multiple async systems (WebSocket, database, Web Worker). Prioritize tests that prevent data loss.

### Priority 1: Critical Path Tests (Prevent Data Loss)

#### Test: Stuck Detection Triggers on Incompatible DB

```typescript
test("shows stuck dialog when server DB is rebuilt", async () => {
  // 1. Connect normally, sync some data
  // 2. Rebuild server DB (new site_id)
  // 3. Verify stuck dialog appears within 10s
  // 4. Verify "Nuke and Resync" recovers successfully
});
```

#### Test: Local Changes Survive Reconnection

```typescript
test("local changes sync after reconnection", async () => {
  // 1. Make local changes while connected
  // 2. Disconnect (kill sync server or network)
  // 3. Verify local data persists
  // 4. Reconnect
  // 5. Verify changes appear on server
});
```

### Priority 2: UI Indicator Accuracy

#### Test: Footer Shows Correct Connection State

```typescript
test("footer shows red when disconnected", async () => {
  // 1. Start with sync disabled
  // 2. Verify footer shows red/disconnected
  // 3. Enable sync
  // 4. Verify footer transitions to green
  // 5. Stop sync server
  // 6. Verify footer transitions to red
});
```

#### Test: Pending Changes Display (When Implemented)

```typescript
test("footer shows pending changes count", async () => {
  // 1. Disconnect sync
  // 2. Make 5 local changes
  // 3. Verify footer shows "5 pending"
  // 4. Reconnect
  // 5. Verify count goes to 0
});
```

### Priority 3: Progress Accuracy (When Fixed)

#### Test: Sync Progress Shows Meaningful Numbers

```typescript
test("progress shows record counts not chunk counts", async () => {
  // 1. Create 5000 records on server
  // 2. Connect fresh client
  // 3. Verify progress shows ~5000 total, not 5 chunks
  // 4. Verify progress increments smoothly
});
```

### Test Infrastructure Notes

The existing `sync.spec.ts` provides a good foundation:

- Uses a local sync server started in `globalSetup`
- Can make direct HTTP calls to server's `/exec` endpoint for remote changes
- Tests both client→server and server→client sync

**Key Utilities Available**:

```typescript
// From apps/e2e/tests/helpers/sync-server.ts
await execOnRemote(dbid, sql); // Execute SQL on server
await waitForSync(); // Wait for sync to settle
```

---

## Implementation Roadmap

### Phase 1: Quick Wins (Low Effort, High Impact)

1. **Remove "Book Data Extension" badge** -- done; only the Remote DB badge remains.
2. **Improve stuck detection messaging** -- already done in recent commits
3. **Add "connecting" state** -- yellow indicator while WebSocket handshake in progress (implemented via derived sync state)

### Phase 2: Pending Changes Tracking

1. Implement `pendingChangesCount` store using crsql_changes query (implemented; uses last sent db_version persisted per DB)
2. Update footer to show count when > 0 (implemented)
3. Add E2E test for pending changes display (added in `apps/e2e/integration/sync.spec.ts`)

### Phase 3: Progress Improvements

1. Refactor `ChangesProcessor` to track change counts, not chunks (implemented; emits final totals even after completion)
2. Update progress dialog to show meaningful numbers (uses change counts now; covered by bulk sync e2e)
3. Consider adding estimated time remaining

### Phase 3.5: File-Watcher Stability

1. Preserve DB extensions in FSNotify (`@vlcn.io/ws-server`) and keep `touchHack` on HTTP writes (implemented locally; needs upstream/backport strategy)
2. Keep `.sqlite3` regression tests active in `apps/e2e/integration/sync.spec.ts`

### Phase 4: Sync Validation

1. ✅ HTTP meta handshake + `incompatible` state + e2e (rebuilt remote DB prompts nuke/resync)
2. Research `@vlcn.io/ws-server` protocol for a first-class handshake (so compatibility detection works even if HTTP meta is blocked)
3. Add E2E test for protocol-level incompatibility detection once implemented

---

## Key Files Reference

| File                                          | Role in Sync                          |
| --------------------------------------------- | ------------------------------------- |
| `lib/stores/app.ts`                           | Connectivity monitor, stuck detection |
| `lib/components/ExtensionStatusBanner.svelte` | Footer badges                         |
| `lib/workers/sync-transport-control.ts`       | Chunking, progress emission           |
| `lib/workers/WorkerInterface.ts`              | Main thread ↔ Worker messaging       |
| `lib/app/sync.ts`                             | High-level sync API, initial sync     |
| `routes/+layout.svelte`                       | Sync dialog, stuck dialog             |
| `e2e/tests/sync.spec.ts`                      | Sync E2E tests                        |

---

## Appendix: Database Queries for Sync State

### Get Local Database Version

```sql
SELECT crsql_db_version();
-- Returns: bigint (e.g., 12345)
```

### Get Peer's Known Version

```sql
SELECT MAX(db_version) FROM crsql_changes WHERE site_id = ?;
-- Returns: last version received from that peer
```

### Count Pending Local Changes

```sql
SELECT COUNT(*) FROM crsql_changes
WHERE site_id = crsql_site_id()
AND db_version > ?;
-- Where ? is the last acknowledged version
```

### Get Local Site ID

```sql
SELECT site_id FROM crsql_site_id WHERE ordinal = 0;
-- Returns: 16-byte blob (the local client's identity)
```

### Get All Known Peers

```sql
SELECT DISTINCT quote(site_id) FROM crsql_changes;
-- Returns: hex-encoded site IDs of all peers that have contributed changes
```
