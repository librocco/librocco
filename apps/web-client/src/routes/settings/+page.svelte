<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";
	import { get } from "svelte/store";
	import Download from "$lucide/download";
	import Trash from "$lucide/trash";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { zod } from "sveltekit-superforms/adapters";

	import { invalidateAll } from "$app/navigation";

	import { testId, addSQLite3Suffix } from "@librocco/shared";
	import { LL } from "@librocco/shared/i18n-svelte";

	import type { PageData } from "./$types";
	import { type DialogContent } from "$lib/types";

	import { DEFAULT_DB_NAME, VERSION } from "$lib/constants";

	import { Page } from "$lib/controllers";

	import { deviceSettingsStore } from "$lib/stores/app";

	import { opfsVFSList, vfsSupportsOPFS } from "$lib/db/cr-sqlite/core/vfs";

	import { DeviceSettingsForm, SyncSettingsForm, DatabaseDeleteForm, databaseCreateSchema, DatabaseCreateForm } from "$lib/forms";
	import { deviceSettingsSchema, syncSettingsSchema } from "$lib/forms/schemas";
	import { retry } from "$lib/utils/misc";
	import { deleteDBFromOPFS } from "$lib/db/cr-sqlite/core/utils";

	import { app, deleteCurrentDb, nukeAndResyncDb, selectDb } from "$lib/app";
	import { getVfs } from "$lib/app/db";

	export let data: PageData;

	$: ({ plugins } = data);

	// Config stores
	const dbid = app.config.dbid;
	const syncUrl = app.config.syncUrl;
	const syncActive = app.config.syncActive;

	// #region files list
	let files: string[] = [];
	// Each time a dbCtx changes, update the file list - this might indicate a DB created / deleted
	// TODO: this isn't working, revisit the DB list reactivity
	$: if (data.dbCtx) getFiles().then((_files) => (files = _files));

	const getFiles = async () => {
		return window.navigator.storage.getDirectory().then(async (dir) => {
			const files = [] as string[];
			for await (const [name] of (dir as any).entries() as AsyncIterableIterator<[string, FileSystemHandle]>) {
				// We're interested only in .sqlite3 files
				if (name.endsWith(".sqlite3")) {
					files.push(name);
				}
			}
			return files;
		});
	};

	onMount(async () => {
		files = await getFiles();
	});

	// #region import control
	let importOn = false;

	const toggleImport = () => (importOn = !importOn);

	const getDroppedSqlite3Files = (event: DragEvent) => {
		if (event.dataTransfer?.items) {
			return Array.from(event.dataTransfer.items)
				.filter((item) => item.kind === "file")
				.map((item) => item.getAsFile())
				.filter((file): file is File => file !== null && file.name.endsWith(".sqlite3"));
		} else if (event.dataTransfer?.files) {
			return Array.from(event.dataTransfer.files).filter((file) => file.name.endsWith(".sqlite3"));
		}
		return [];
	};

	const handleDrop = async (event: DragEvent) => {
		event.preventDefault();

		const sqliteFiles = getDroppedSqlite3Files(event);

		// We support exactly 1 file per import
		if (sqliteFiles.length !== 1) return;
		const [file] = sqliteFiles;

		// TODO: handle a case when we're overwriting the current DB
		await deleteDBFromOPFS(file.name);

		// Import the file
		const dir = await window.navigator.storage.getDirectory();
		const fileHandle = await dir.getFileHandle(file.name, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(await file.arrayBuffer());
		await writable.close();

		await handleSelect(file.name)();

		importOn = false;
	};

	const handleDragOver = (event: DragEvent) => {
		event.preventDefault();
	};

	// #region select db control
	let selectionOn = false;
	const toggleSelection = () => (selectionOn = !selectionOn);
	// TODO: This used the old functionality and currently doesn't work, revisit
	const handleSelect = (name: string) => async () => {
		// Persist the selection
		dbid.set(addSQLite3Suffix(name));
		// Reset the db (allowing the root load function to reinstantiate the db)
		// resetDB();
		// Recalculate the data from root load down
		await invalidateAll();
		// Close the modal
		selectionOn = false;
	};

	// #region db operations
	const handleExportDatabase = (name: string) => async () => {
		const dir = await window.navigator.storage.getDirectory();
		const file = await dir.getFileHandle(name);
		const blob = await file.getFile();
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
		document.removeChild(a);
	};

	const handleCreateDatabase = async (_name: string) => {
		const name = addSQLite3Suffix(_name);
		// Select will create a DB if not exists
		await selectDb(app, name, getVfs(app));
		open.set(false);
		files = await getFiles();
	};

	const handleDeleteDatabase = (name: string) => async () => {
		const vfs = getVfs(app);

		try {
			// Case: deleting the current DB
			if (name === get(dbid)) {
				// When deleting the current DB, we're selecting the first one from the list (as the next active one).
				// If the list is empty (only currently active DB exists): create a new DB with the default name (after deletion).
				const nextDbid = files.find((fname) => fname !== name) || DEFAULT_DB_NAME;
				await deleteCurrentDb(app, { dbid: nextDbid, vfs });
			} else {
				// Case: deleting non-active DB - easy path: no connections/references - delete the DB file
				await deleteDBFromOPFS(name);
			}
		} finally {
			// Local state cleanup
			open.set(false);
			deleteDatabase = null;
		}
	};

	const handleNukeAndResync = () => nukeAndResyncDb(app, get(dbid), getVfs(app));

	// #region dialog
	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger, title, description, content },
		states: { open }
	} = dialog;
	let deleteDatabase = { name: "" };

	let dialogContent: (DialogContent & { type: "create" | "delete" }) | null = null;

	$: ({ settings_page: tSettings, common: tCommon } = $LL);
</script>

<Page title={tSettings.headings.settings()} view="settings" {app} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col divide-y">
		<div class="p-4">
			<h4>{tSettings.stats.version()} {VERSION}</h4>
		</div>
		<div class="flex h-full flex-col space-y-12 overflow-y-auto p-6">
			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">{tSettings.headings.sync_settings()}</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">
						{tSettings.descriptions.sync_settings()}
					</p>
				</div>

				<div class="w-full basis-2/3">
					<SyncSettingsForm
						active={syncActive}
						data={data.syncSettingsForm}
						options={{
							SPA: true,
							dataType: "json",
							validators: zod(syncSettingsSchema),
							validationMethod: "submit-only",
							onUpdated: ({ form: { data, valid } }) => {
								if (valid) {
									dbid.set(data.dbid);
									syncUrl.set(data.url);
									// TODO: rely on startSync to invalidate all
									invalidateAll();
								}
							}
						}}
					/>
				</div>
			</div>

			<div data-testid={testId("database-management-container")} class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">{tSettings.headings.db_management()}</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">{tSettings.descriptions.db_management()}</p>

					{#if data.dbCtx?.vfs}
						<p class="mt-8 inline-block rounded bg-gray-400 px-4 py-1 text-white">{data.dbCtx.vfs}</p>
					{/if}
				</div>

				<div class="w-full basis-2/3">
					<div data-testid={testId("database-management-list")} class="h-[240px] w-full overflow-hidden">
						{#if importOn}
							<!-- Import drop area, NOTE: with current state of things this should be unreachable with no-OPFS VFS -->

							<div
								class="flex h-full items-center justify-center border-2 border-dashed border-base-100"
								on:drop={handleDrop}
								role="region"
								aria-label="Drop zone"
								on:dragover={handleDragOver}
							>
								<p>{tSettings.descriptions.import()}</p>
							</div>
						{:else if !vfsSupportsOPFS(data.dbCtx?.vfs)}
							<!-- DB management is not supported for idb-batch-atomic (as the implementation is non-trivial) -->

							<div
								class="h-full select-none items-center justify-center overflow-y-auto overflow-x-hidden rounded border border-gray-100 bg-gray-100 p-4 text-gray-500"
							>
								<div>
									<p>
										The following functionality is not available for <span class="rounded bg-gray-300 px-2 py-1">{data.dbCtx?.vfs}</span>
										vfs: <strong>Import</strong>, <strong>Export</strong>, <strong>Select</strong>, <strong>New</strong>
										<br />
										<br />
										Please use OPFS-supported VFS by setting a local storage entry
										<span class="rounded bg-gray-300 px-2 py-1">vfs: {"<vfs-name>"}</span> with one of the following values:
									</p>
									<ul class="pl-4">
										{#each opfsVFSList as vfs}
											<li>- {vfs}</li>
										{/each}
									</ul>
								</div>
							</div>
						{:else}
							<ul class="h-full w-full overflow-y-auto overflow-x-hidden border">
								{#each files as file (file)}
									{@const active = addSQLite3Suffix(file) === addSQLite3Suffix($dbid)}
									{#if selectionOn}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<li
											on:click={handleSelect(file)}
											data-active={active}
											class="group flex h-16 cursor-pointer items-center justify-between px-4 py-3 {active
												? 'bg-green-300'
												: 'hover:bg-gray-50'}"
										>
											<button>{file} </button>
										</li>
									{:else}
										<li
											data-file={file}
											data-active={active}
											class="group flex h-16 items-center justify-between px-4 py-3 {active ? 'bg-gray-200' : ''}"
										>
											<span>{file}</span>
											<div class="hidden gap-x-2 group-hover:flex">
												<button
													data-testid={testId("db-action-export")}
													on:click={handleExportDatabase(file)}
													type="button"
													class="btn-primary btn-sm btn cursor-pointer"><Download /></button
												>
												<button
													data-testid={testId("db-action-delete")}
													use:melt={$trigger}
													on:m-click={() => {
														deleteDatabase = { name: file };
														dialogContent = {
															onConfirm: () => {}, // Note: confirm handler is called directly from the form element
															title: tCommon.delete_dialog.title({ entity: file }),
															description: tCommon.delete_database_dialog.description(),
															type: "delete"
														};
													}}
													on:m-keydown={() => {
														deleteDatabase = { name: file };
														dialogContent = {
															onConfirm: () => {}, // Note: confirm handler is called directly from the form element
															title: tCommon.delete_dialog.title({ entity: file }),
															description: tCommon.delete_database_dialog.description(),
															type: "delete"
														};
													}}
													type="button"
													class="btn-primary btn-sm btn cursor-pointer"><Trash /></button
												>
											</div>
										</li>
									{/if}
								{/each}
							</ul>
						{/if}
					</div>

					<div class="flex justify-end gap-x-2 px-4 py-6">
						<button on:click={handleNukeAndResync} type="button" class="btn-secondary btn">{tSettings.actions.nuke_and_resync()}</button>
						{#if vfsSupportsOPFS(data.dbCtx?.vfs)}
							<button on:click={toggleImport} type="button" class="btn-secondary btn">
								{importOn ? tCommon.actions.cancel() : tCommon.actions.import()}
							</button>
							<button on:click={toggleSelection} type="button" class="btn {!selectionOn ? 'btn-secondary btn-outline' : 'btn-primary'}">
								{tCommon.actions.select()}
							</button>
							<button
								use:melt={$trigger}
								on:m-click={() => {
									dialogContent = {
										onConfirm: () => {}, // Note: confirm handler is called directly from the form element
										title: tCommon.create_database_dialog.title(),
										description: tCommon.create_database_dialog.description(),
										type: "create"
									};
								}}
								on:m-keydown={() => {
									dialogContent = {
										onConfirm: () => {}, // Note: confirm handler is called directly from the form element
										title: tCommon.create_database_dialog.title(),
										description: tCommon.create_database_dialog.description(),
										type: "create"
									};
								}}
								type="button"
								class="btn-primary btn">{tSettings.labels.new()}</button
							>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-6 px-4 pb-20 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">{tSettings.headings.device_settings()}</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">{tSettings.descriptions.device_settings()}</p>
				</div>
				<div class="w-full basis-2/3">
					<DeviceSettingsForm
						data={data.deviceSettingsForm}
						options={{
							SPA: true,
							dataType: "json",
							validators: zod(deviceSettingsSchema),
							validationMethod: "submit-only",
							onUpdated: ({ form: { data, valid } }) => {
								if (valid) {
									deviceSettingsStore.set(data);
									// Invalidating all in order to refresh the form data (done within the load function)
									invalidateAll();
								}
							}
						}}
					/>
				</div>
			</div>
		</div>
	</div>
</Page>

{#if $open}
	{@const { type, title: dialogTitle, description: dialogDescription } = dialogContent};

	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }}></div>

		{#if type === "create"}
			<div
				class="fixed left-[50%] top-[50%] z-50 flex max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col gap-y-8 rounded-md bg-white px-4 py-6"
				use:melt={$content}
			>
				<h2 class="sr-only" use:melt={$title}>
					{dialogTitle}
				</h2>
				<p class="sr-only" use:melt={$description}>
					{dialogDescription}
				</p>
				<DatabaseCreateForm
					options={{
						SPA: true,
						dataType: "json",
						validators: zod(databaseCreateSchema),
						validationMethod: "submit-only",
						onUpdated: ({ form }) => handleCreateDatabase(form?.data?.name)
					}}
					onCancel={() => open.set(false)}
				/>
			</div>
		{:else if type === "delete"}
			<div class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
				<DatabaseDeleteForm
					{dialog}
					{dialogTitle}
					{dialogDescription}
					name={deleteDatabase.name}
					options={{
						SPA: true,
						dataType: "json",
						validationMethod: "submit-only",
						onSubmit: handleDeleteDatabase(deleteDatabase.name)
					}}
				/>
			</div>
		{:else}
			<!---->
		{/if}
	</div>
{/if}
