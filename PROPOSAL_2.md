# Tabbed Supplier Config UI - Implementation Plan

## Summary

Add tab-based navigation to the supplier detail page to separate "Orders" and "Assigned Publishers" views, matching the Figma Make specification (Version 76).

---

## Background

### Current Implementation (Incorrect)

- Single view showing both the publishers split-column layout AND the orders table on the same page
- Parent container has `md:overflow-y-auto` causing synchronized scrolling issue
- No tab control to switch between views

### Figma Make Specification (Correct - Version 76)

Based on [Figma Make - Supplier Config BRANCH: Split Assigned Publishers List](https://www.figma.com/make/EART7vgFgu96XN2alfWF3N/%E2%98%85-Librocco--Supplier-Config-BRANCH-Split-Assigned-Publishers-List?p=f&t=jvdTi28sEYY78aax-0)

- **Two tabs controlled by buttons at top:**
  1. **"Orders" tab** - Shows supplier order history (OrderedTable component)
  2. **"Assigned Publishers" tab** - Shows the split-column publisher management layout
- Parent container should use `min-h-0` instead of `overflow-auto` (Version 76 fix)
- Only the Orders tab needs `overflow-auto` for traditional scrolling
- Assigned Publishers tab needs the split-column layout with internal scrolling

---

## Implementation Plan

### Phase 1: Fix E2E Test Issue

**File:** `apps/e2e/integration/supplier_mgmt.spec.ts:67`

**Issue:** The E2E test references an old navigation pattern using the "Edit" button to access the supplier detail page.

**Fix:** Update the test to:
1. Navigate directly to supplier detail page or use proper navigation method
2. Add tab selection step to navigate to "Assigned Publishers" tab
3. Remove obsolete selectors that no longer exist

### Phase 2: Add Tab State Management

**File:** `apps/web-client/src/routes/orders/suppliers/[id]/+page.svelte`

**Add new type Svelte store imports (at top of script section, after other imports):**

```typescript
import { writable } from "svelte/store";
```

**Add new type and store (after line 58, before `goto` reactive statement):**

```typescript
type Tab = "orders" | "publishers";
const activeTab = writable<Tab>("orders");
```

**No setTab helper function needed - use store directly.**

### Phase 3: Add Tab Navigation UI

**File:** `apps/web-client/src/routes/orders/suppliers/[id]/+page.svelte`

**Location:** Insert after the supplier details card (after line 204, before the main content div)

```svelte
<!-- Tab Navigation -->
<div class="flex gap-x-2 border-b border-gray-200 pb-0">
  <button
    class="btn btn-ghost btn-sm border-b-2 {$activeTab === 'orders' ? 'border-primary' : 'border-transparent'}"
    on:click={() => activeTab.set('orders')}
  >
    Orders
  </button>
  <button
    class="btn btn-ghost btn-sm border-b-2 {$activeTab === 'publishers' ? 'border-primary' : 'border-transparent'}"
    on:click={() => activeTab.set('publishers')}
  >
    Assigned Publishers
  </button>
</div>
```

### Phase 4: Restructure Content with Conditional Rendering

**File:** `apps/web-client/src/routes/orders/suppliers/[id]/+page.svelte`

**Replace the entire main content div (lines 206-290) with:**

```svelte
<!-- Orders Tab -->
{#if $activeTab === "orders"}
  <div class="mb-20 h-full overflow-x-auto">
    <div class="h-full">
      <OrderedTable orders={data.orders} on:reconcile={handleReconcile} on:download={handleDownload} />
    </div>
  </div>
{/if}

<!-- Assigned Publishers Tab -->
{#if $activeTab === "publishers"}
  <div class="flex h-full w-full flex-col pb-20 md:pb-0">
    <div class="sticky top-0 z-20 bg-white p-4">
      <div class="flex items-center gap-2">
        <input type="text" placeholder="Search publishers..." bind:value={searchQuery} class="input input-bordered w-full text-sm" />
        {#if searchQuery}
          <button on:click={() => (searchQuery = "")} class="btn-xs btn-circle btn" aria-label="Clear search">✕</button>
        {/if}
      </div>
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Left: Assigned Publishers -->
      <div class="flex min-w-0 flex-1 flex-col border-r border-gray-200">
        <div class="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-2">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold">Assigned Publishers</h3>
            <span class="badge-neutral badge badge-sm">{filteredAssigned.length}</span>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          {#each filteredAssigned as publisher}
            <div class="flex items-center justify-between px-4 py-2 text-sm hover:bg-base-200">
              <span class="truncate">{publisher}</span>
              <button on:click={handleUnassignPublisher(publisher)} class="btn-ghost btn-outline btn-xs btn whitespace-nowrap">
                {t.labels.remove_publisher()}
              </button>
            </div>
          {/each}
          {#if filteredAssigned.length === 0}
            <div class="px-4 py-8 text-center text-sm text-gray-500">
              {searchQuery ? "No matching assigned publishers" : "No assigned publishers"}
            </div>
          {/if}
        </div>
      </div>

      <!-- Right: Available Publishers -->
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-2">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold">Available Publishers</h3>
            <span class="badge-neutral badge badge-sm">{filteredAvailable.length}</span>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          {#each filteredAvailable as pub}
            <div class="flex items-center justify-between px-4 py-2 text-sm hover:bg-base-200">
              <span class="flex items-center gap-2 truncate">
                {pub.name}
                {#if pub.supplierName}
                  <span class="badge-warning badge badge-xs max-w-[100px] truncate" title={`Currently assigned to ${pub.supplierName}`}>
                    {pub.supplierName}
                  </span>
                {/if}
              </span>
              <button on:click={pub.supplierName
                ? () => {
                    confirmationPublisher = pub.name;
                    confirmationDialogOpen.set(true);
                  }
                : handleAssignPublisher(pub.name)}
                class="btn-primary btn-xs btn whitespace-nowrap"
              >
                {pub.supplierName ? t.labels.reassign_publisher() : t.labels.add_to_supplier()}
              </button>
            </div>
          {/each}
          {#if filteredAvailable.length === 0}
            <div class="px-4 py-8 text-center text-sm text-gray-500">
              {searchQuery ? "No matching available publishers" : "No available publishers"}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
```

### Phase 5: Check for Tab Parameter in Page Load

**File:** `apps/web-client/src/routes/orders/suppliers/[id]/+page.svelte.ts`

No changes needed - the data layer can remain as is since both tabs use the same data. The tab state is derived from the URL query parameter in the component.

### Phase 6: Update E2E Tests

**File:** `apps/e2e/integration/supplier_mgmt.spec.ts`

**Update the test to navigate to the correct tab:**

```typescript
testOrders("displays split column layout with search functionality", async ({ page, suppliers, books, suppliersWithPublishers }) => {
  depends(books);
  depends(suppliersWithPublishers);

  await page.goto(appHash("suppliers"));
  const dbHandle = await getDbHandle(page);

  await dbHandle.evaluate(upsertBook, { isbn: "978-0-306-40615-7", title: "Book A", author: "Author A", publisher: "Publisher A" });

  // Navigate to supplier detail page
  await page.goto(appHash("suppliers", suppliers[0].id));
  await page.getByText(suppliers[0].name, { exact: true }).waitFor();

  // Navigate to "Assigned Publishers" tab
  await page.getByRole("button", { name: "Assigned Publishers" }).click();

  // Wait for the new layout to load
  await page.getByText("Assigned Publishers").waitFor();

  // ... rest of the test remains the same
});
```

---

## Files to Modify

1. **`apps/web-client/src/routes/orders/suppliers/[id]/+page.svelte`**
   - Add `writable` store import from `svelte/store`
   - Add `Tab` type definition
   - Add `activeTab` store (writable)
   - Insert tab navigation buttons at top of content area
   - Wrap Orders table in `$activeTab === "orders"` condition
   - Wrap publishers layout in `$activeTab === "publishers"` condition
   - Remove or adjust `md:overflow-y-auto` from parent container (Version 76 scrolling fix)

2. **`apps/e2e/integration/supplier_mgmt.spec.ts`**
   - Update test to use direct URL navigation to supplier detail page
   - Add tab selection step to navigate to "Assigned Publishers" tab
   - Remove any references to old "Edit" button navigation pattern

---

## Technical Details

### Local State Management

The tab state will be managed using a Svelte writable store for:
- Simple state management - No need for URL manipulation
- Fast tab switching - No page reload needed
- Component-scoped state - Each supplier page has its own tab state

**Implementation:**
```typescript
import { writable } from "svelte/store";

type Tab = "orders" | "publishers";
const activeTab = writable<Tab>("orders");
```

**Usage in template:**
```svelte
{#if $activeTab === "orders"}
  <!-- Orders content -->
{/if}

{#if $activeTab === "publishers"}
  <!-- Publishers content -->
{/if}
```

### Scrolling Behavior Fix (Version 76)

From Figma Make Version 76 reasoning:
> The parent container in `SupplierDetailView.tsx` had `overflow-auto` on line 51, which was creating a single scroll container that wrapped both columns. This caused both columns to scroll together no matter where your cursor was.

**Fix:**
- Remove `overflow-auto` from parent container
- Add `min-h-0` to properly constrain the flexbox child
- Add `h-full` to the content containers so they fill available space
- Add `overflow-auto` only to the Orders tab which needs traditional scrolling
- Publishers tab uses the split-column layout with internal `overflow-y-auto` on each column

---

## Implementation Checklist

### Code Changes
- [ ] Import `writable` from `svelte/store`
- [ ] Add `Tab` type to `+page.svelte`
- [ ] Add `activeTab` writable store
- [ ] Insert tab navigation buttons (tablist pattern)
- [ ] Wrap Orders table in conditional block using `$activeTab`
- [ ] Wrap Publishers layout in conditional block using `$activeTab`
- [ ] Remove/adjust `md:overflow-y-auto` from parent container

### Testing
- [ ] Verify tab switching works correctly
- [ ] Update E2E tests to use tab navigation
- [ ] Run all E2E tests: `cd apps/e2e && rushx test:run`
- [ ] Run lint: `rush lint:strict`
- [ ] Run typecheck: `rush typecheck`

### Manual Testing
- [ ] Navigate to a supplier detail page
- [ ] Click "Orders" tab - verify orders table displays
- [ ] Click "Assigned Publishers" tab - verify split-column layout displays
- [ ] Test search functionality in Publishers tab
- [ ] Test independent scrolling of publisher columns
- [ ] Test sticky headers in Publishers tab

---

## Success Criteria

1. ✅ Two distinct tabs visible at top of supplier detail page
2. ✅ "Orders" tab shows supplier order history with traditional scrolling
3. ✅ "Assigned Publishers" tab shows split-column layout with internal scrolling
4. ✅ Tab switching works smoothly with no page reload
5. ✅ No synchronized scrolling issue in split-column layout (Version 76 fix)
7. ✅ All existing functionality (search, add/remove/reassign publishers) still works
8. ✅ E2E tests pass
9. ✅ No lint or typecheck errors
10. ✅ Responsive across different screen sizes

---

## Design Rationale

### Why Local State Management?

1. **Simple**: No URL manipulation needed - just update the store
2. **Fast**: Instant tab switching with no page reload
3. **Component-scoped**: Each supplier page maintains its own tab state independently
4. **Standard pattern**: Uses Svelte's reactive store system which is well-integrated with the framework

### Why Conditional Rendering vs. Route Split?

- Both tabs share the same data (`assignedPublishers`, `availablePublishers`, `orders`)
- Keeping them in one component avoids duplicate data fetching
- Simpler to maintain - single file for supplier details
- Faster tab switching - no page reload needed

### Why Remove `overflow-auto` from Parent?

From Figma Make Version 76:
> The parent container had `overflow-auto` which was creating a single scroll container that wrapped both columns. This caused both columns to scroll together no matter where your cursor was.

By using `min-h-0` and allowing individual containers to manage their own scrolling:
- Orders tab gets traditional scrolling with `overflow-auto`
- Publishers tab uses the correct independent scrolling with `overflow-y-auto` on each column
- Sticky headers work correctly within each scrollable area

---

## Migration Notes

### Breaking Changes

None - this is a UI enhancement that maintains all existing functionality.

### Backward Compatibility

- Default view remains "Orders" tab (original behavior)
- No URL changes required
- No database changes required
- No API changes required

---

**Date:** 2026-01-23
**Design Source:** [Figma Make - Supplier Config BRANCH: Split Assigned Publishers List (Version 76)](https://www.figma.com/make/EART7vgFgu96XN2alfWF3N/%E2%98%85-Librocco--Supplier-Config-BRANCH-Split-Assigned-Publishers-List?p=f&t=jvdTi28sEYY78aax-0)
