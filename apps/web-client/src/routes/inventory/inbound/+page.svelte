<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Library, Loader2 as Loader, Trash } from "lucide-svelte";
	import { firstValueFrom, map } from "rxjs";

	import { entityListView, testId, wrapIter } from "@librocco/shared";

	import { PlaceholderBox, Dialog } from "$lib/components";

	import { getDB } from "$lib/db";

	import { noteToastMessages, toastSuccess } from "$lib/toasts";
	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const inNoteListCtx = { name: "[IN_NOTE_LIST]", debug: false };
	const inNoteListStream = db
		?.stream()
		.inNoteList(inNoteListCtx)
		.pipe(
			map((m) =>
				wrapIter(m)
					.filter(([warehouseId]) => !warehouseId.includes("0-all"))
					.flatMap(([warehouseId, { displayName, notes }]) => wrapIter(notes).map((note) => [displayName || warehouseId, note] as const))
					.array()
			)
		)!;
	const inNoteList = readableFromStream(inNoteListCtx, inNoteListStream, []);

	let initialized = false;
	onMount(() => {
		firstValueFrom(inNoteListStream).then(() => (initialized = true));
	});

	// TODO: This way of deleting notes is rather slow - update the db interface to allow for more direct approach
	const handleDeleteNote = (noteId: string) => async () => {
		const result = await db?.findNote(noteId);

		if (!result) {
			return;
		}
		await result.note.delete({});
		toastSuccess(noteToastMessages("Note").noteDeleted);
	};

	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger },
		states: { open }
	} = dialog;

	let dialogContent: DialogContent;
</script>

<!-- The Page layout is rendered by the parent (inventory) '+layout.svelte', with inbound and warehouse page rendering only their respective entity lists -->

{#if !initialized}
	<div class="center-absolute">
		<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
	</div>
{:else}
	<!-- Start entity list contaier -->

	<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
	<ul class={testId("entity-list-container")} data-view={entityListView("inbound-list")} data-loaded={true}>
		{#if !$inNoteList.length}
			<!-- Start entity list placeholder -->
			<PlaceholderBox
				title="No open notes"
				description="Get started by adding a new note with the appropriate warehouse"
				class="center-absolute"
			>
				<a href={appPath("warehouses")} class="mx-auto inline-block items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
					><span class="text-green-50">Back to warehouses</span></a
				>
			</PlaceholderBox>
			<!-- End entity list placeholder -->
		{:else}
			<!-- Start entity list -->
			{#each $inNoteList as [warehouseName, [noteId, note]]}
				{@const noteName = note.displayName || noteId}
				{@const displayName = `${warehouseName} / ${noteName}`}
				{@const updatedAt = generateUpdatedAtString(note.updatedAt)}
				{@const totalBooks = note.totalBooks}
				{@const href = appPath("inbound", noteId)}

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
							<span class="badge badge-sm badge-green">Last updated: {updatedAt}</span>
						{:else}
							<!-- Inside 'flex justify-between' container, we want the following box (buttons) to be pushed to the end, even if there's no badge -->
							<div />
						{/if}

						<div class="flex items-center justify-end gap-3">
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
					</div>
				</li>
			{/each}
			<!-- End entity list -->
		{/if}
	</ul>
	<!-- End entity list contaier -->
{/if}

<div use:melt={$portalled}>
	{#if $open}
		{@const { onConfirm, title, description } = dialogContent};

		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }} />
		<div class="fixed left-[50%] top-[50%] z-50 flex max-w-2xl translate-x-[-50%] translate-y-[-50%]">
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
