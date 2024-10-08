<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Library, Loader2 as Loader, Trash } from "lucide-svelte";
	import { firstValueFrom, map } from "rxjs";

	import { entityListView, testId, wrapIter } from "@librocco/shared";

	import InventoryManagementPage from "$lib/components/InventoryManagementPage.svelte";
	import { PlaceholderBox, Dialog } from "$lib/components";

	import { getDB } from "$lib/db";
	import { goto } from "$lib/utils/navigation";

	import { type DialogContent, dialogTitle, dialogDescription } from "$lib/dialogs";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { readableFromStream } from "$lib/utils/streams";
	import { compareNotes } from "$lib/utils/misc";

	import { appPath } from "$lib/paths";

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const { db, status } = getDB();

	const inNoteListCtx = { name: "[IN_NOTE_LIST]", debug: false };
	const inNoteListStream = db
		?.stream()
		.inNoteList(inNoteListCtx)
		.pipe(
			map((m) =>
				wrapIter(m)
					.filter(([warehouseId]) => !warehouseId.includes("all"))
					.flatMap(([warehouseId, { displayName, notes }]) => wrapIter(notes).map((note) => [displayName || warehouseId, note] as const))
					.array()
					.sort(([, [, a]], [, [, b]]) => compareNotes(a, b))
			)
		)!;
	const inNoteList = readableFromStream(inNoteListCtx, inNoteListStream, []);

	let initialized = false;
	onMount(() => {
		if (status) {
			firstValueFrom(inNoteListStream).then(() => (initialized = true));
		} else {
			goto(appPath("settings"));
		}
	});

	// TODO: This way of deleting notes is rather slow - update the db interface to allow for more direct approach
	const handleDeleteNote = (noteId: string) => async (closeDialog: () => void) => {
		const result = await db?.findNote(noteId);

		if (!result) {
			return;
		}
		await result.note.delete({});
		closeDialog();
	};

	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger },
		states: { open }
	} = dialog;

	let dialogContent: DialogContent;
</script>

<InventoryManagementPage>
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
					<a
						href={appPath("warehouses")}
						class="mx-auto inline-block items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
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

					<div class="group entity-list-row">
						<div class="flex flex-col gap-y-2">
							<a {href} class="entity-list-text-lg text-gray-900 hover:underline focus:underline">{displayName}</a>

							<div class="flex flex-col items-start gap-y-2">
								<div class="flex gap-x-0.5">
									<Library class="mr-1 text-gray-700" size={24} />
									<span class="entity-list-text-sm text-gray-500">{totalBooks} books</span>
								</div>
								{#if note.updatedAt}
									<span class="badge badge-md badge-green">
										Last updated: {updatedAt}
									</span>
								{/if}
							</div>
						</div>

						<div class="entity-list-actions">
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
				<Dialog {dialog} type="delete" {onConfirm}>
					<svelte:fragment slot="title">{title}</svelte:fragment>
					<svelte:fragment slot="description">{description}</svelte:fragment>
				</Dialog>
			</div>
		{/if}
	</div>
</InventoryManagementPage>
