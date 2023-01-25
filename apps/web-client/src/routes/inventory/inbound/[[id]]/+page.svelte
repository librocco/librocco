<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import {
		InventoryPage,
		SidebarItemGroup,
		TextField,
		Pagination,
		Badge,
		BadgeColor,
		InventoryTable,
		InventoryTableRow,
		Header,
		SelectMenu,
		TextEditable
	} from '@librocco/ui';

	import { NoteState } from '$lib/enums/db';

	import { db } from '$lib/db';

	import { generateUpdatedAtString } from '$lib/utils/time';

	import { observableFromStore } from '$lib/utils/streams';
	import { from, BehaviorSubject, EMPTY, combineLatest } from 'rxjs';
	import { map, switchMap, tap } from 'rxjs/operators';

	import { noteStateLookup, noteStates, NoteTempState } from '$lib/enums/inventory';
	import type { NoteInterface } from '$lib/types/db';

	import {
		createPaginationStream,
		createEntriesStream,
		createDisplayNameStream,
		createNoteStateStream
	} from '$lib/rx/factories';

	const {
		inNoteList: inNoteList$,
		allNotesList: allNotesList$,
		allInNotes: allInNotes$,
		bookStock: bookStock$
	} = db().stream();

	const localDisplayName$ = new BehaviorSubject('');
	const localNoteState$ = new BehaviorSubject<NoteTempState | null>(null);
	const localCurrentPage$ = new BehaviorSubject(0);

	const pageId$ = observableFromStore(page).pipe(
		map((page) => page?.params?.id),
		tap(() => localDisplayName$.next('')),
		tap(() => localNoteState$.next(null)),
		tap(() => localCurrentPage$.next(0))
	);

	const currentNoteLookup$ = combineLatest([pageId$, allNotesList$]).pipe(map(([id, notes]) => notes[id] || {}));
	const currentNote$ = combineLatest([pageId$, allInNotes$]).pipe(map(([id, notes]) => notes[id] || {}));

	const noteEntries$ = currentNote$.pipe(map(({ entries }) => entries));

	$: ({ updatedAt } = $currentNote$);
	$: displayName$ = createDisplayNameStream(currentNote$, localDisplayName$, pageId$);
	$: noteState$ = createNoteStateStream(currentNote$, localNoteState$);
	$: entries$ = createEntriesStream(noteEntries$, localCurrentPage$, bookStock$);
	$: paginationData$ = createPaginationStream(noteEntries$, localCurrentPage$);

	$: noteInterface = db().warehouse($currentNoteLookup$?.warehouse).note($pageId$);

	// Navigate back to /inventory/inbound if the note doesn't exist (or is deleted)
	$: if ($pageId$ && (!$currentNoteLookup$ || $currentNoteLookup$.state === NoteState.Deleted)) {
		goto('/inventory/inbound');
	}

	// TODO: Should use `createDbUpdateStream` - but currently errors due to race condition with noteInterface
	const setDisplayName$ = localDisplayName$.pipe(
		switchMap((name) => {
			if (!name) {
				return EMPTY;
			} else {
				const promise = noteInterface.setName(name);
				return from(promise);
			}
		})
	);

	// TODO: Should use `createDbUpdateStream` - but currently errors due to race condition with noteInterface
	const updateNoteStateAction = (noteInterface: NoteInterface, state: NoteTempState) => {
		switch (state) {
			case NoteTempState.Committing:
				return noteInterface.commit();
			case NoteTempState.Deleting:
				return noteInterface.delete();
			default:
				return Promise.resolve();
		}
	};

	const updateNoteState$ = localNoteState$.pipe(
		switchMap((state) => {
			if (!state) {
				return EMPTY;
			} else {
				const promise = updateNoteStateAction(noteInterface, state);
				return from(promise);
			}
		}),
		tap(() => localNoteState$.next(null))
	);

	// auto subscribe() / unsubscribe() dbUpdateStreams
	$setDisplayName$;
	$updateNoteState$;

	// Event handlers
	const handleDisplayNameUpdate = (value: string) => localDisplayName$.next(value);

	const handleNoteStateUpdate = (detail: NoteState) => {
		const tempState = noteStateLookup[detail].tempState;
		localNoteState$.next(tempState);
	};
</script>

<!-- svelte-ignore missing-declaration -->
<InventoryPage>
	<!-- Header slot -->
	<Header title="Inbound" currentLocation="/inventory/inbound" slot="header" />

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		{#each $inNoteList$ as { id, displayName, notes }, index (id)}
			<SidebarItemGroup
				name={displayName || id}
				{index}
				items={notes?.map(({ id, displayName }) => ({
					name: displayName || id,
					href: `/inventory/inbound/${id}`,
					current: id === $page.params.id
				}))}
			/>
		{/each}
	</nav>

	<!-- Table header slot -->
	<svelte:fragment slot="tableHeader">
		{#if $noteState$ && $noteState$ !== NoteState.Deleted}
			<div class="flex w-full items-end justify-between">
				<div>
					<h2 class="cursor-normal mb-4 select-none text-lg font-medium text-gray-900">
						<TextEditable value={$displayName$} onSave={handleDisplayNameUpdate} />
						<span class="align-middle text-sm font-normal text-gray-500"
							>in {$currentNoteLookup$?.warehouse}</span
						>
					</h2>
					<div class="flex items-center gap-1.5 whitespace-nowrap">
						<SelectMenu
							class="w-[138px]"
							options={noteStates}
							value={$noteState$}
							on:change={({ detail }) => handleNoteStateUpdate(detail)}
							disabled={[...Object.values(NoteTempState), NoteState.Committed].includes($noteState$)}
						/>
						{#if updatedAt}
							<Badge
								label="Last updated: {generateUpdatedAtString(new Date(updatedAt))}"
								color={BadgeColor.Success}
							/>
						{/if}
					</div>
				</div>
				<TextField name="search" placeholder="Serach">
					<Search slot="startAdornment" class="h-5 w-5" />
				</TextField>
			</div>
		{/if}
	</svelte:fragment>

	<!-- Table slot -->
	<svelte:fragment slot="table">
		{#if $entries$.length}
			<InventoryTable>
				{#each $entries$ as data}
					<InventoryTableRow {data} />
				{/each}
			</InventoryTable>
		{/if}
	</svelte:fragment>

	<!-- Table footer slot -->
	<div class="flex h-full items-center justify-between" slot="tableFooter">
		{#if $paginationData$.totalItems}
			<p class="cursor-normal select-none text-sm font-medium leading-5">
				Showing <strong>{$paginationData$.firstItem}</strong> to <strong>{$paginationData$.lastItem}</strong> of
				<strong>{$paginationData$.totalItems}</strong> results
			</p>
		{/if}
		{#if $paginationData$.numPages > 1}
			<Pagination maxItems={7} bind:value={$localCurrentPage$} numPages={$paginationData$.numPages} />
		{/if}
	</div>
</InventoryPage>
