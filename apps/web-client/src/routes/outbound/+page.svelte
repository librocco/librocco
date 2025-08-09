<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { invalidate } from "$app/navigation";

	import { createDialog, melt } from "@melt-ui/svelte";
	import Plus from "$lucide/plus";
	import Trash from "$lucide/trash";
	import Library from "$lucide/library";
	import FilePlus from "$lucide/file-plus";
	import Layers from "$lucide/layers";
	import ClockArrowUp from "$lucide/clock-arrow-up";

	import { racefreeGoto } from "$lib/utils/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { PlaceholderBox, Dialog } from "$lib/components";
	import { Page } from "$lib/controllers";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { appPath } from "$lib/paths";
	import { createOutboundNote, deleteNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import LL from "@librocco/shared/i18n-svelte";
	import PageCenterDialog from "$lib/components/Melt/PageCenterDialog.svelte";
	import ConfirmDialog from "$lib/components/Dialogs/ConfirmDialog.svelte";

	export let data: PageData;

	$: ({ notes, plugins } = data);
	$: db = data.dbCtx?.db;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Note (names/list) and book_transaction (note's totalBooks) all affect the list
		disposer = data.dbCtx?.rx?.onRange(["note", "book_transaction"], () => invalidate("outbound:list"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	let initialized = false;
	$: initialized = Boolean(db);

	const handleDeleteNote = async (id: number) => {
		open.set(false);
		await deleteNote(db, id);
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

	const dialog = createDialog();
	const {
		elements: { portalled, overlay, trigger },
		states: { open }
	} = dialog;

	let noteToDelete = null;
	$: tOutboundPage = $LL.sale_page;
	$: tPages = $LL.page_headings;
</script>

<Page title={tPages.outbound()} view="outbound" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col gap-y-4 divide-y">
		<div class="flex w-full items-center">
			<div class="flex w-full items-center justify-end p-4">
				<button on:click={handleCreateNote} class="btn-primary btn-sm btn">
					<Plus size={20} aria-hidden />
					{tOutboundPage.labels.new_sale()}
				</button>
			</div>
		</div>

		{#if !initialized}
			<div class="flex grow justify-center">
				<div class="mx-auto translate-y-1/2">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			</div>
		{:else}
			<!-- Start entity list contaier -->

			<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
			<ul class={testId("entity-list-container")} data-view={entityListView("outbound-list")}>
				{#if !notes.length}
					<!-- Start entity list placeholder -->

					<div class="flex grow justify-center">
						<div class="mx-auto max-w-xl translate-y-1/2">
							<!-- Start entity list placeholder -->
							<PlaceholderBox title={tOutboundPage.labels.no_open_sales()} description={tOutboundPage.labels.get_started()}>
								<FilePlus slot="icon" />
								<button slot="actions" on:click={handleCreateNote} class="btn-primary btn w-full">
									{tOutboundPage.labels.new_sale()}
								</button>
							</PlaceholderBox>
							<!-- End entity list placeholder -->
						</div>
					</div>
					<!-- End entity list placeholder -->
				{:else}
					<!-- Start entity list -->
					{#each notes as note}
						{@const displayName = note.displayName || `Note - ${note.id}`}
						{@const updatedAt = generateUpdatedAtString(note.updatedAt)}
						{@const totalBooks = note.totalBooks}
						{@const href = appPath("outbound", note.id)}

						<div class="group entity-list-row">
							<div class="flex flex-col gap-y-2">
								<a {href} class="entity-list-text-lg text-base-content hover:underline focus:underline">{displayName}</a>

								<div class="flex flex-row gap-x-8 gap-y-2 max-sm:flex-col">
									<div class="flex gap-x-2">
										<Layers size={18} />
										<span class="entity-list-text-sm text-sm text-base-content">{tOutboundPage.stats.books({ bookCount: totalBooks })}</span
										>
									</div>

									{#if note.updatedAt}
										<div class="flex items-center gap-x-2 text-sm text-base-content">
											<ClockArrowUp size={18} />
											{tOutboundPage.stats.last_updated()}:
											{updatedAt}
										</div>
									{/if}
								</div>
							</div>

							<div class="entity-list-actions">
								<a {href} class="btn-secondary btn-outline btn-sm btn">{tOutboundPage.labels.edit()}</a>

								<button
									use:melt={$trigger}
									class="btn-secondary btn-sm btn"
									aria-label="Delete note: {note.displayName}"
									on:m-click={() => {
										noteToDelete = note;
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

<PageCenterDialog
	{dialog}
	on:cancel={() => {
		open.set(false);
		noteToDelete = null;
	}}
	title={$LL.common.delete_dialog.description()}
	description={$LL.common.delete_dialog.title({ entity: noteToDelete?.displayName })}
>
	<ConfirmDialog
		on:confirm={() => {
			handleDeleteNote(noteToDelete.id);
			noteToDelete = null;
		}}
		on:cancel={() => {
			open.set(false);
			noteToDelete = null;
		}}
		labels={{ confirm: "Confirm", cancel: "Cancel" }}
	/>
</PageCenterDialog>
