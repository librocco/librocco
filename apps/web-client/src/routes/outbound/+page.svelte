<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fade } from "svelte/transition";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Plus, Trash, Loader2 as Loader, Library } from "lucide-svelte";

	import { racefreeGoto } from "$lib/utils/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { PlaceholderBox, Dialog } from "$lib/components";
	import { Page } from "$lib/controllers";

	import { type DialogContent } from "$lib/types";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { appPath } from "$lib/paths";
	import { createOutboundNote, deleteNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	$: ({ notes, plugins } = data);
	$: db = data.dbCtx?.db;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;
		// Note (names/list) and book_transaction (note's totalBooks) all affect the list
		disposer = rx.onRange(["note", "book_transaction"], () => invalidate("outbound:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	let initialized = false;
	$: initialized = Boolean(db);

	const handleDeleteNote = (id: number) => async (closeDialog: () => void) => {
		await deleteNote(db, id);
		closeDialog();
	};

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);
		await goto(appPath("outbound", id));
	};

	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger },
		states: { open }
	} = dialog;

	let dialogContent: DialogContent | null = null;
	$: tOutboundPage = $LL.outbound_page;
</script>

<Page title="Outbound" view="outbound" {db} {plugins}>
	<div slot="main" class="h-full w-full">
		<div class="flex w-full items-center justify-end">
			<button
				on:click={handleCreateNote}
				class="flex items-center gap-2 rounded-md border border-gray-300 bg-white py-[9px] pl-[15px] pr-[17px]"
			>
				<span><Plus size={20} /></span>
				<span class="text-sm font-medium leading-5 text-gray-700">{tOutboundPage.labels.new_note()}</span>
			</button>
		</div>

		{#if !initialized}
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else}
			<!-- Start entity list contaier -->

			<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
			<ul class={testId("entity-list-container")} data-view={entityListView("outbound-list")}>
				{#if !notes.length}
					<!-- Start entity list placeholder -->
					<PlaceholderBox title="No open notes" description="Get started by adding a new note" class="center-absolute">
						<button on:click={handleCreateNote} class="mx-auto flex items-center gap-2 rounded-md bg-teal-500 py-[9px] pl-[15px] pr-[17px]"
							><span class="text-green-50">{tOutboundPage.labels.new_note()}</span></button
						>
					</PlaceholderBox>
					<!-- End entity list placeholder -->
				{:else}
					<!-- Start entity list -->
					{#each notes as note}
						{@const displayName = note.displayName || `Note - ${note.id}`}
						{@const updatedAt = generateUpdatedAtString(note.updatedAt)}
						{@const totalBooks = note.totalBooks}
						{@const href = appPath("outbound", note.id)}

						<div class="entity-list-row group">
							<div class="flex flex-col gap-y-2">
								<a {href} class="entity-list-text-lg text-gray-900 hover:underline focus:underline">{displayName}</a>

								<div class="flex flex-col items-start gap-y-2">
									<div class="flex gap-x-0.5">
										<Library class="mr-1 text-gray-700" size={24} />
										<span class="entity-list-text-sm text-gray-500">{tOutboundPage.stats.books({ bookCount: totalBooks })}</span>
									</div>
									{#if note.updatedAt}
										<span class="badge badge-md badge-green">
											{tOutboundPage.stats.last_updated()}: {updatedAt}
										</span>
									{/if}
								</div>
							</div>

							<div class="entity-list-actions">
								<a {href} class="button button-alert"><span class="button-text">{tOutboundPage.labels.edit()}</span></a>

								<button
									use:melt={$trigger}
									class="button button-white"
									aria-label="Delete note: {note.displayName}"
									on:m-click={() => {
										dialogContent = {
											onConfirm: handleDeleteNote(note.id),
											title: $LL.common.delete_dialog.title({ entity: note.displayName }),
											description: $LL.common.delete_dialog.description()
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
	</div>
</Page>

{#if $open}
	{@const { onConfirm, title, description } = dialogContent};
	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}></div>
		<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
			<Dialog {dialog} type="delete" {onConfirm}>
				<svelte:fragment slot="title">{title}</svelte:fragment>
				<svelte:fragment slot="description">{description}</svelte:fragment>
			</Dialog>
		</div>
	</div>
{/if}
