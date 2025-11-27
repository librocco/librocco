# The Schema/Code Temporal Rift: A Discussion Draft

## The Context
We are building a Local-First application. This means every user's browser is a distinct node in a distributed system. Unlike a standard web app where we deploy Server+DB simultaneously, our users can (and will) load new Application Code (vX+1) while sitting on top of an old Database (vX).

## Current State: "Hash & Halt"
Our current defense against this rift is located in `apps/web-client/src/lib/db/cr-sqlite/db.ts`.

1.  **The Trigger:** We hash the entire content of `src/lib/schemas/init`. Any change—even a comment—changes the `schemaVersion` hash.
2.  **The Guard:** On app boot (`+layout.ts`), we call `getInitializedDB`. It compares the App's hash vs. the DB's stored hash.
3.  **The Halt:** If they mismatch, we throw `ErrDBSchemaMismatch`. The app acts as a firewall: it refuses to load the main UI.
4.  **The Escape Hatch:** `+layout.svelte` catches the error and presents a "Database out of date" dialog. The user clicks "Migrate," triggering `db.automigrateTo()`.

## Shortcomings: Why It Still Hurts
Despite this system, we are seeing issues. Here is the breakdown of the structural weaknesses:

1.  **The "Optimization" Trap:** We are currently refactoring for performance (`feature/optimize-load`). If we move `getInitializedDB` off the critical path (i.e., stop `await`-ing it in `load` functions to show UI faster), we remove the firewall. The UI will render, attempt a query like `SELECT new_column FROM table`, and crash before the migration dialog ever appears.
2.  **The False Positives:** Because we hash the *file content*, a corrected typo in a comment triggers a full "Database out of date" scary dialog for every user. This trains users to ignore the warning or fear updates.
3.  **The "Automigrate" Black Box:** We rely on `cr-sqlite`'s `automigrateTo`. While powerful, it is heuristic-based. If we introduce a complex constraint or a rename that `automigrateTo` misinterprets, the migration succeeds technically, but the app logic fails runtime.
4.  **Sync vs. Schema:** When the server updates, it might reject sync changes from an old client, or the client might ingest data it can't store yet. The timing of "Sync First" vs "Migrate First" is currently implicit and fragile.

## Technical Possibilities & Recommendations

We have a few paths forward, ranging from "Safe" to "Sophisticated."

### 1. The Iron Curtain (Safe)
**Stick to blocking initialization.**
If the schema doesn't match, the app *must not* render any route that touches the DB.
*   **Pros:** Guarantees code/DB alignment.
*   **Cons:** Slower initial load. The "Optimization" branch must respect this constraint.

### 2. Explicit Versioning (Sanity)
**Stop hashing the file.**
Switch to an explicit `const SCHEMA_VERSION = 42`.
*   **Pros:** We only trigger migrations when we *know* the schema changed structurally. Documentation/comment fixes don't break the user experience.
*   **Cons:** Requires developer discipline to increment the integer.

### 3. Silent Automigration (UX)
**Why ask the user?**
If the migration is non-destructive (adding a column, adding a table), `cr-sqlite` can handle it safely.
*   **Proposal:** `getInitializedDB` attempts a silent `automigrateTo()`. Only if that fails (destructive change detected) do we throw the error and show the dialog.
*   **Pros:** Seamless updates for 90% of cases.

### 4. The Typed-SQL Future (Robustness)
We have `typed-sql` in our `3rd-party` folder.
If we integrate this, our queries become strictly tied to the schema at *compile time*.
*   **Pros:** If we change the schema, TypeScript breaks every query that relies on the old structure. We catch the "optimistic crash" in VS Code, not in the user's browser.

## Discussion Goal
We need to decide: **Do we prioritize startup speed (optimistic loading) or stability (blocking migration)?**
*Recommendation:* We cannot have optimistic loading *and* schema drift. If we want fast loads, we must implement Silent Automigration (Option 3) to resolve the drift before the first query runs.
