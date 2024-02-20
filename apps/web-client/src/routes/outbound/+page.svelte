<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Plus, Search, Trash, Loader2 as Loader, Library } from "lucide-svelte";
	import { firstValueFrom, map } from "rxjs";

	import { goto } from "$app/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import { getDB } from "$lib/db";

	import { Page, PlaceholderBox, Dialog } from "$lib/components";

	import { noteToastMessages, toastSuccess } from "$lib/toasts";
	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

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

	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger },
		states: { open }
	} = dialog;

	let dialogContent: DialogContent | null = null;
</script>

<Page view="outbound" loaded={initialized}>
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
		{:else}
			<!-- Start entity list contaier -->

			<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
			<ul class={testId("entity-list-container")} data-view={entityListView("outbound-list")} data-loaded={true}>
				{#if !$outNoteList.length}
					<!-- Start entity list placeholder -->
					<PlaceholderBox title="No open notes" description="Get started by adding a new note" class="center-absolute">
						<button on:click={handleCreateNote} class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
							><span class="text-green-50">New note</span></button
						>
					</PlaceholderBox>
					<!-- End entity list placeholder -->
				{:else}
					<!-- Start entity list -->
					{#each $outNoteList as [noteId, note]}
						{@const displayName = note.displayName || noteId}
						{@const updatedAt = generateUpdatedAtString(note.updatedAt)}
						{@const totalBooks = note.totalBooks}
						{@const href = appPath("outbound", noteId)}

						<li class="entity-list-row grid grid-flow-col grid-cols-12 items-center">
							<div class="max-w-1/2 xs:col-span-6 col-span-10 row-span-1 w-full lg:row-span-2">
								<p class="entity-list-text-lg text-gray-900">{displayName}</p>

								<div class="flex items-center">
									<Library class="mr-1 text-gray-700" size={20} />
									<span class="entity-list-text-sm text-gray-500">{totalBooks} books</span>
								</div>
							</div>

							{#if note.updatedAt}
								<div class="xs:col-span-6 col-span-10 row-span-1 lg:col-span-3 lg:row-span-2">
									<span class="badge badge-sm badge-green">Last updated: {updatedAt}</span>
								</div>
							{/if}

							<div class="entity-list-actions xs:col-span-6 col-span-2 row-span-2">
								<a {href} class="button button-alert"><span class="button-text">Edit</span></a>
								<button
									use:melt={$trigger}
									class="button button-white"
									aria-label="Delete note: {note.displayName}"
									on:m-click={() => {
										dialogContent = {
											onConfirm: handleDeleteNote(noteId),
											title: dialogTitle.delete(note.displayName),
											description: dialogDescription.deleteNote()
										};
									}}
								>
									<span aria-hidden="true">
										<Trash size={20} />
									</span>
								</button>
							</div>
						</li>
					{/each}
					<!-- End entity list -->
				{/if}
			</ul>
			<!-- End entity list contaier -->
		{/if}
	</svelte:fragment>
</Page>

<div use:melt={$portalled}>
	{#if $open}
		{@const { onConfirm, title, description } = dialogContent};

		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }} />
		<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
			<Dialog
				{dialog}
				type="delete"
				onConfirm={async (closeDialog) => {
					await onConfirm();
					closeDialog();
				}}
			>
				<svelte:fragment slot="title">{title}</svelte:fragment>
				<svelte:fragment slot="description">{description}</svelte:fragment>
			</Dialog>
		</div>
	{/if}
</div>
