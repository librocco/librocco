<script lang="ts">
	import { Plus, Search, Trash, Loader2 as Loader, Library } from "lucide-svelte";
	import { firstValueFrom, map } from "rxjs";
	import { onMount } from "svelte";

	import { Badge, BadgeColor } from "@librocco/ui";

	import { goto } from "$app/navigation";

	import { Page, PlaceholderBox } from "$lib/components";

	import { getDB } from "$lib/db";

	import { noteToastMessages, toastSuccess } from "$lib/toasts";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";

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
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else if !$outNoteList.length}
			<PlaceholderBox title="No open notes" description="Get started by adding a new note" class="center-absolute">
				<button on:click={handleCreateNote} class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
					><span class="text-green-50">New note</span></button
				>
			</PlaceholderBox>
		{:else}
			<ul class="entity-list-container">
				{#each $outNoteList as [noteId, note]}
					{@const displayName = note.displayName || noteId}
					{@const updatedAt = generateUpdatedAtString(note.updatedAt)}
					{@const totalBooks = note.totalBooks}
					{@const href = appPath("outbound", noteId)}

					<li class="entity-list-row">
						<div class="max-w-1/2 w-full">
							<p class="entity-list-text-lg text-gray-900">{displayName}</p>

							<div class="flex items-center">
								<Library class="mr-1 text-gray-700" size={20} />
								<span class="entity-list-text-sm text-gray-500">{totalBooks} books</span>
							</div>
						</div>

						<div class="max-w-1/2 flex w-full items-center justify-between">
							{#if note.updatedAt}
								<Badge label="Last updated: {updatedAt}" color={BadgeColor.Success} />
							{:else}
								<!-- Inside 'flex justify-between' container, we want the following box (buttons) to be pushed to the end, even if there's no badge -->
								<div />
							{/if}

							<div class="flex items-center justify-end gap-3">
								<a {href} class="button button-alert"><span class="button-text">Edit</span></a>
								<button on:click={handleDeleteNote(noteId)} class="button button-white"><Trash size={20} /></button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</svelte:fragment>
</Page>
