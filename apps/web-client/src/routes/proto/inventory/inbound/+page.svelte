<script lang="ts">
	import { Trash } from "lucide-svelte";
	import { map } from "rxjs";

	import { Badge, BadgeColor } from "@librocco/ui/Badge";
	import { wrapIter } from "@librocco/shared";

	import { EntityList, EntityListRow, PlaceholderBox } from "$lib/components";

	import { getDB } from "$lib/db";

	import { noteToastMessages, toastSuccess } from "$lib/toasts";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";

	import { PROTO_PATHS } from "$lib/paths";

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const inNoteListCtx = { name: "[IN_NOTE_LIST]", debug: false };
	const inNoteList = readableFromStream(
		inNoteListCtx,
		db
			?.stream()
			.inNoteList(inNoteListCtx)
			.pipe(
				map((m) =>
					wrapIter(m)
						.filter(([warehouseId]) => !warehouseId.includes("0-all"))
						.flatMap(([warehouseId, { displayName, notes }]) => wrapIter(notes).map((note) => [displayName || warehouseId, note] as const))
						.array()
				)
			),
		[]
	);

	// TODO: This way of deleting notes is rather slow - update the db interface to allow for more direct approach
	const handleDeleteNote = (noteId: string) => async () => {
		const { note } = await db?.findNote(noteId);
		await note?.delete({});
		toastSuccess(noteToastMessages("Note").noteDeleted);
	};
</script>

<!-- The Page layout is rendered by the parent (inventory) '+layout.svelte', with inbound and warehouse page rendering only their respective entity lists -->

{#if !$inNoteList.length}
	<PlaceholderBox
		title="No open notes"
		description="Get started by adding a new note with the appropriate warehouse"
		class="center-absolute"
	>
		<a href={PROTO_PATHS.WAREHOUSES} class="mx-auto inline-block items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
			><span class="text-green-50">Back to warehouses</span></a
		>
	</PlaceholderBox>
{:else}
	<EntityList>
		{#each $inNoteList as [warehouseName, [noteId, note]]}
			{@const noteName = note.displayName || noteId}
			{@const displayName = `${warehouseName} / ${noteName}`}
			{@const updatedAt = generateUpdatedAtString(note.updatedAt)}
			{@const totalBooks = note.totalBooks}
			{@const href = `${PROTO_PATHS.INBOUND}/${noteId}`}

			<EntityListRow {totalBooks} {displayName}>
				<svelte:fragment slot="actions">
					{#if note.updatedAt}
						<Badge label="Last updated: {updatedAt}" color={BadgeColor.Success} />
					{:else}
						<!-- Inside 'flex justify-between' container, we want the following box (buttons) to be pushed to the end, even if there's no badge -->
						<div />
					{/if}

					<div class="flex items-center justify-end gap-3">
						<a {href} class="rounded-md bg-pink-50 px-[17px] py-[9px]"
							><span class="text-sm font-medium leading-5 text-pink-700">Edit</span></a
						>
						<button on:click={handleDeleteNote(noteId)} class="rounded-md border border-gray-300 bg-white py-[9px] pl-[17px] pr-[15px]"
							><Trash class="border-gray-500" size={20} /></button
						>
					</div>
				</svelte:fragment>
			</EntityListRow>
		{/each}
	</EntityList>
{/if}
