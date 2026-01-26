# Supplier-Publisher Assignment UI Refactor

## Summary

Refactor the supplier-publisher assignment UI from a **3-table stacked layout** to a **2-column split layout** with a shared search bar, optimized for handling 100-300 publishers efficiently.

---

## Design Overview

### Current Implementation

- Three separate tables stacked vertically with max-height 208px each:
  1. "Selected books" (assigned publishers) - with "Remove publisher" buttons
  2. "Unassigned publishers" - with "Add to supplier" buttons
  3. "Other Supplier Publishers" - with "Reassign publisher" buttons (requires confirmation)
- No search functionality
- Fixed height containers showing limited rows
- No visual distinction for publishers from other suppliers

### New Figma Make Design

Based on [Version 76: Split Assigned Publishers List](https://www.figma.com/make/EART7vgFgu96XN2alfWF3N/%E2%98%85-Librocco--Supplier-Config-BRANCH-Split-Assigned-Publishers-List?p=f&t=jvdTi28sEYY78aax-0)

- **Single sticky search bar** at top filtering both columns simultaneously (sticky top-0 z-20 bg-white)
- **Two-column split layout:**
  - Left: "Assigned Publishers"
  - Right: "Available Publishers" (combines unassigned + other suppliers' publishers)
- **Independent scrolling** in each column with sticky headers (sticky top-0 z-10)
- **Compact styling**: py-2 row heights, 13px text for handling large lists
- **Counter badges** showing filtered counts dynamically
- **Warning badges** for publishers from other suppliers (truncated supplier name showing owner)
- **Internal scrolling** using `overflow-y-auto min-h-0` with proper flexbox constraints

---

## Implementation Plan

### 1. Database Layer Changes

#### File: `apps/web-client/src/lib/db/cr-sqlite/suppliers.ts`

**Add new function** after line 156 (after `_getPublishersFor`):

```typescript
/**
 * Retrieves all publishers with their associated supplier information.
 * Used for the split UI showing which publishers belong to which suppliers.
 *
 * @param db - The database instance to query
 * @returns Promise resolving to array of {publisher, supplier_name}
 */
async function _getPublishersWithSuppliers(db: TXAsync): Promise<{publisher: string; supplier_name: string}[]> {
  const query = `
    SELECT
      sp.publisher,
      s.name as supplier_name
    FROM supplier_publisher sp
    LEFT JOIN supplier s ON sp.supplier_id = s.id
    ORDER BY sp.publisher ASC
  `;
  return await db.execO<{publisher: string; supplier_name: string}>(query);
}
```

**Export the function** at end of file (around line 524):

```typescript
export const getPublishersWithSuppliers = timed(_getPublishersWithSuppliers);
```

---

### 2. Page Data Layer Changes

#### File: `apps/web-client/src/routes/orders/suppliers/[id]/+page.ts`

**Add new type** at top of file:

```typescript
type PublisherInfo = {
  name: string;
  supplierName?: string; // Only set if assigned to another supplier
};
```

**Modify `_load` function** to fetch and combine publisher data:

**Current code** (lines 43-53):
```typescript
const [assignedPublishers, allPublishers, allAssignedPublishers] = await Promise.all(
  getPublishersFor(db, id),
  getPublisherList(db),
  getPublishersFor(db)
);

const publishersAssignedToOtherSuppliers = allAssignedPublishers.filter((p) => !assignedPublishers.includes(p));
const publishersUnassignedToSuppliers = allPublishers.filter((p) => !allAssignedPublishers.includes(p));
```

**New code:**
```typescript
const [assignedPublishers, allPublishers, publishersWithSuppliers] = await Promise.all([
  getPublishersFor(db, id),
  getPublisherList(db),
  getPublishersWithSuppliers(db)
]);

// Create a map for quick lookup of publisher -> supplier
const publisherToSupplier = new Map(publishersWithSuppliers.map(p => [p.publisher, p.supplier_name]));

// Build available publishers array with supplier info
const availablePublishers: PublisherInfo[] = allPublishers
  .filter((pub) => !assignedPublishers.includes(pub))
  .map((pub) => ({
    name: pub,
    supplierName: publisherToSupplier.get(pub) // undefined if unassigned
  }));
```

**Modify return object** (lines 64-70):

**Current:**
```typescript
return {
  supplier,
  assignedPublishers,
  publishersAssignedToOtherSuppliers,
  publishersUnassignedToSuppliers,
  orders: [...unreconciledOrders, ...reconciledOrders]
};
```

**New:**
```typescript
return {
  supplier,
  assignedPublishers,
  availablePublishers,
  orders: [...unreconciledOrders, ...reconciledOrders]
};
```

---

### 3. UI Component Changes

#### File: `apps/web-client/src/routes/orders/suppliers/[id]/+page.svelte`

#### Script Section Changes

**Add new stores and reactive values** after line 63:

```typescript
let searchQuery = "";

$: filteredAssigned = searchQuery
  ? assignedPublishers.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
  : assignedPublishers;

$: filteredAvailable = searchQuery
  ? availablePublishers.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  : availablePublishers;
```

#### Template Section Changes

**Replace lines 197-276** (three table sections) with:

```svelte
<div class="flex h-full w-full flex-col pb-20 md:pb-0">
  <!-- Search bar - sticky -->
  <div class="sticky top-0 z-20 bg-white p-4">
    <div class="flex items-center gap-2">
      <input
        type="text"
        placeholder="Search publishers..."
        bind:value={searchQuery}
        class="input input-bordered w-full text-sm"
      />
      {#if searchQuery}
        <button on:click={() => searchQuery = ''} class="btn btn-circle btn-xs" aria-label="Clear search">
          ✕
        </button>
      {/if}
    </div>
  </div>

  <!-- Two-column grid with independent scrolling -->
  <div class="flex flex-1 min-h-0 overflow-hidden">
    <!-- Left: Assigned Publishers -->
    <div class="flex flex-col min-w-0 flex-1 border-r border-gray-200">
      <div class="sticky top-0 z-10 bg-white px-4 py-2 border-b border-gray-100">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold">Assigned Publishers</h3>
          <span class="badge badge-sm badge-neutral">{filteredAssigned.length}</span>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0">
        {#each filteredAssigned as publisher}
          <div class="flex justify-between items-center px-4 py-2 text-sm hover:bg-base-200">
            <span class="truncate">{publisher}</span>
            <button
              on:click={handleUnassignPublisher(publisher)}
              class="btn btn-xs btn-outline btn-ghost whitespace-nowrap"
            >
              {t.labels.remove_publisher()}
            </button>
          </div>
        {/each}
        {#if filteredAssigned.length === 0}
          <div class="px-4 py-8 text-sm text-gray-500 text-center">
            {searchQuery ? 'No matching assigned publishers' : 'No assigned publishers'}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Available Publishers -->
    <div class="flex flex-col min-w-0 flex-1">
      <div class="sticky top-0 z-10 bg-white px-4 py-2 border-b border-gray-100">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold">Available Publishers</h3>
          <span class="badge badge-sm badge-neutral">{filteredAvailable.length}</span>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0">
        {#each filteredAvailable as pub}
          <div class="flex justify-between items-center px-4 py-2 text-sm hover:bg-base-200">
            <span class="flex items-center gap-2 truncate">
              {pub.name}
              {#if pub.supplierName}
                <span class="badge badge-warning badge-xs truncate max-w-[100px]" title={`Currently assigned to ${pub.supplierName}`}>
                  {pub.supplierName}
                </span>
              {/if}
            </span>
            <button
              on:click={pub.supplierName ? (() => { confirmationPublisher = pub.name; confirmationDialogOpen.set(true); }) : handleAssignPublisher(pub.name)}
              class="btn btn-xs btn-primary whitespace-nowrap"
            >
              {pub.supplierName ? t.labels.reassign_publisher() : t.labels.add_to_supplier()}
            </button>
          </div>
        {/each}
        {#if filteredAvailable.length === 0}
          <div class="px-4 py-8 text-sm text-gray-500 text-center">
            {searchQuery ? 'No matching available publishers' : 'No available publishers'}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
```

---

## Files to Modify

1. **Database Layer**
   - `apps/web-client/src/lib/db/cr-sqlite/suppliers.ts` - Add `_getPublishersWithSuppliers` function and export

2. **Page Data Layer**
   - `apps/web-client/src/routes/orders/suppliers/[id]/+page.ts` - Modify data fetching and return structure

3. **UI Component**
   - `apps/web-client/src/routes/orders/suppliers/[id]/+page.svelte` - Refactor template layout and add search functionality

---

## Breaking Changes

### API Changes (internal)

**Page data structure change:**

**Old:**
```typescript
{
  assignedPublishers: string[],
  publishersAssignedToOtherSuppliers: string[],
  publishersUnassignedToSuppliers: string[],
}
```

**New:**
```typescript
{
  assignedPublishers: string[],
  availablePublishers: PublisherInfo[],
}
```

Where `PublisherInfo` is:
```typescript
type PublisherInfo = {
  name: string;
  supplierName?: string;
};
```

This is **internal only** - the component itself is the only consumer of this data.

---

## Testing Updates Required

### File: `apps/e2e/integration/supplier_mgmt.spec.ts`

Test starting at line 50 (`displays three different lists of publishers correctly`) needs to be updated to:

1. Expect two-column layout instead of three tables
2. Test search functionality:
   - Search for specific publishers
   - Verify both columns filter correctly
   - Test clear search button
3. Test badges:
   - Verify warning badges appear for publishers from other suppliers
   - Verify supplier names in badges
4. Test sticky headers:
   - Scroll each column and verify headers stay visible
   - Verify search bar stays fixed at top
5. Test reassign functionality still works with confirmation dialog

---

## Migration Checklist

### Database Layer
- [ ] Add `_getPublishersWithSuppliers()` function to `suppliers.ts`
- [ ] Export `getPublishersWithSuppliers` with `timed()` wrapper

### Data Layer
- [ ] Add `PublisherInfo` type to `+page.ts`
- [ ] Update `load()` function to fetch `publishersWithSuppliers`
- [ ] Create `publisherToSupplier` map
- [ ] Build `availablePublishers` array with supplier info
- [ ] Update return object to use new structure

### UI Component
- [ ] Add `searchQuery` state variable
- [ ] Add reactive `filteredAssigned` computed value
- [ ] Add reactive `filteredAvailable` computed value
- [ ] Replace three-table layout with two-column grid
- [ ] Add sticky search bar with clear button
- [ ] Add sticky column headers with counter badges
- [ ] Add warning badges for other supplier publishers
- [ ] Add empty states for filtered lists
- [ ] Ensure proper flexbox scrolling with `min-h-0`
- [ ] Test independent column scrolling

### Testing
- [ ] Update E2E test for new 2-column layout
- [ ] Add search functionality tests
- [ ] Add badge display tests
- [ ] Add sticky header tests
- [ ] Run all tests: `rushx test`

### Code Quality
- [ ] Run lint: `rush lint`
- [ ] Run typecheck: `rush typecheck`
- [ ] Manually test in browser at `/orders/suppliers/[id]/`

---

## Success Criteria

1. ✅ Search bar filters both columns simultaneously
2. ✅ Columns scroll independently
3. ✅ Search bar and column headers remain sticky during scrolling
4. ✅ Warning badges show for publishers owned by other suppliers
5. ✅ Counter badges update dynamically based on filter results
6. ✅ Layout handles 100-300+ publishers efficiently
7. ✅ All existing functionality (add/remove/reassign) still works
8. ✅ E2E tests pass
9. ✅ No lint or typecheck errors
10. ✅ Responsive across different screen sizes

---

## Design Rationale

### Why 2 columns instead of 3?

- **Reduces cognitive load**: Users only see assigned vs available (simplified mental model)
- **Better space utilization**: Combines similar publisher types (unassigned + other suppliers)
- **Clearer action paths**: "Add" for unassigned, "Reassign" (with warning) for other suppliers
- **Easier search**: Single search box filtering across available publishers makes sense

### Why sticky headers?

- **Always visible context**: Users always know which column they're viewing
- **Better UX with long lists**: When scrolling through 100+ publishers, headers maintain context
- **Consistent with best practices**: Sticky elements improve usability for data-dense views

### Why independent scrolling?

- **Improved performance**: Only rendering visible items in viewport
- **Better UX comparison**: Can compare lists while scrolling each independently
- **Fixed search bar**: Search always accessible without scrolling back to top

### Why warning badges for other suppliers?

- **Visual feedback**: Users immediately see ownership status
- **Prevent accidental reassignment**: Warning makes it clear this affects another supplier
- **Space efficiency**: Truncated badges save space while conveying information

---

## Future Enhancements

1. **Sortable columns**: Allow sorting by publisher name alphabetically
2. **Bulk actions**: Select multiple publishers for batch assignment/removal
3. **Drag and drop**: Drag publishers between columns to reassign
4. **Filter by supplier**: Filter available publishers by their current owner
5. **Keyboard navigation**: Arrow keys to navigate lists, Enter to select
6. **Toast notifications**: Success messages after assignment/removal/reassignment

---

**Date:** 2026-01-23
**Design Source:** [Figma Make - Supplier Config BRANCH: Split Assigned Publishers List](https://www.figma.com/make/EART7vgFgu96XN2alfWF3N/%E2%98%85-Librocco--Supplier-Config-BRANCH-Split-Assigned-Publishers-List?p=f&t=jvdTi28sEYY78aax-0)
