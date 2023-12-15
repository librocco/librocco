<script lang="ts">
	import { Plus, Search, Trash } from "lucide-svelte";
	import { firstValueFrom, map } from "rxjs";

	import { Badge, BadgeColor, ProgressBar } from "@librocco/ui";

	import { goto } from "$app/navigation";

	import { EntityList, EntityListRow, Page, PlaceholderBox } from "$lib/components";

	import { getDB } from "$lib/db";

	import { noteToastMessages, toastSuccess } from "$lib/toasts";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";
	import { onMount } from "svelte";

	const db = getDB();

	const outNoteListCtx = { name: "[OUT_NOTE_LIST]", debug: false };
	const outNoteListStream = db
		?.stream()
		.outNoteList(outNoteListCtx)
		/** @TODO we could probably wrap the Map to be ArrayLike (by having 'm.length' = 'm.size') */
		.pipe(map((m) => [...m]));
	const outNoteList = readableFromStream(outNoteListCtx, outNoteListStream, []);

	let initialized = false;
	onMount(() => {
		firstValueFrom(outNoteListStream).then(() => (initialized = true));
	});

	// TODO: This way of deleting notes is rather slow - update the db interface to allow for more direct approach
	const handleDeleteNote = (noteId: string) => async () => {
		const { note } = await db?.findNote(noteId);
		await note?.delete({});
		toastSuccess(noteToastMessages("Note").noteDeleted);
	};

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateNote = async () => {
		const note = await db.warehouse().note().create();
		toastSuccess(noteToastMessages("Note").outNoteCreated);
		await goto(appPath("outbound", note._id));
	};
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">Outbound</h1>
			<button
				on:click={handleCreateNote}
				class="flex items-center gap-2 rounded-md border border-gray-300 bg-white py-[9px] pl-[15px] pr-[17px]"
			>
				<span><Plus size={20} /></span>
				<span class="text-sm font-medium leading-5 text-gray-700">New note</span>
			</button>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if !initialized}
			<ProgressBar class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
		{:else if !$outNoteList.length}
			<PlaceholderBox title="No open notes" description="Get started by adding a new note" class="center-absolute">
				<button on:click={handleCreateNote} class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
					><span class="text-green-50">New note</span></button
				>
			</PlaceholderBox>
		{:else}
			<EntityList>
				{#each $outNoteList as [noteId, note]}
					{@const displayName = note.displayName || noteId}
					{@const updatedAt = generateUpdatedAtString(note.updatedAt)}
					{@const totalBooks = note.totalBooks}
					{@const href = appPath("outbound", noteId)}

					<EntityListRow {displayName} {totalBooks}>
						<svelte:fragment slot="actions">
							{#if Boolean(updatedAt)}
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
	</svelte:fragment>
</Page>
