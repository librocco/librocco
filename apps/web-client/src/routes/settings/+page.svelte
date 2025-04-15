<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";
	import { get } from "svelte/store";
	import { Download, Trash } from "lucide-svelte";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { zod } from "sveltekit-superforms/adapters";

	import { testId, addSQLite3Suffix } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { dbid, syncConfig, syncActive } from "$lib/db";

	import { DeviceSettingsForm, SyncSettingsForm, DatabaseDeleteForm, databaseCreateSchema, DatabaseCreateForm } from "$lib/forms";
	import { deviceSettingsSchema, syncSettingsSchema } from "$lib/forms/schemas";
	import { Page } from "$lib/controllers";

	import { type DialogContent } from "$lib/types";

	import { VERSION } from "$lib/constants";
	import { invalidateAll } from "$app/navigation";
	import { deviceSettingsStore } from "$lib/stores/app";
	import { LL } from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	$: ({ plugins } = data);
	$: db = data.dbCtx?.db;

	// #region files list
	let files: string[] = [];

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

	const handleDrop = async (event: DragEvent) => {
		event.preventDefault();
		if (event.dataTransfer?.items) {
			for (let i = 0; i < event.dataTransfer.items.length; i++) {
				const item = event.dataTransfer.items[i];
				if (item.kind === "file") {
					const file = item.getAsFile();
					if (file && file.name.endsWith(".sqlite3")) {
						await importDatabase(file);
					}
				}
			}
		} else if (event.dataTransfer?.files) {
			for (let i = 0; i < event.dataTransfer.files.length; i++) {
				const file = event.dataTransfer.files[i];
				if (file && file.name.endsWith(".sqlite3")) {
					await importDatabase(file);
				}
			}
		}
		files = await getFiles();
		importOn = false;
	};

	const handleDragOver = (event: DragEvent) => {
		event.preventDefault();
	};

	const importDatabase = async (file: File) => {
		const dir = await window.navigator.storage.getDirectory();
		const fileHandle = await dir.getFileHandle(file.name, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(await file.arrayBuffer());
		await writable.close();
		await handleSelect(file.name)();
	};

	// #region select db control
	let selectionOn = false;
	const toggleSelection = () => (selectionOn = !selectionOn);
	// TODO: This used the old functionality and currently doesn't work, revisit
	const handleSelect = (name: string) => async () => {
		// Persist the selection
		dbid.set(name);
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

	const handleCreateDatabase = async (name: string) => {
		await handleSelect(name)();
		open.set(false);
		files = await getFiles();
	};

	const handleDeleteDatabase = (name: string) => async () => {
		const dir = await window.navigator.storage.getDirectory();
		await dir.removeEntry(name);
		files = await getFiles();

		// If we've just deleted the current database, select the first one in the list
		if (!files.includes(addSQLite3Suffix(get(dbid)))) {
			await handleSelect(files[0] || "dev")(); // If this was the last file, create a new (default) db
		}

		open.set(false);
		deleteDatabase = null;
	};

	// #region dialog
	const dialog = createDialog({ forceVisible: true });
	const {
		elements: { portalled, overlay, trigger, title, description, content },
		states: { open }
	} = dialog;
	let deleteDatabase = { name: "" };

	let dialogContent: (DialogContent & { type: "create" | "delete" }) | null = null;
</script>

<Page title="Settings" view="settings" {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col divide-y">
		<div class="p-4">
			<h4>{$LL.settings_page.stats.version()} {VERSION}</h4>
		</div>
		<div class="flex h-full flex-col space-y-12 overflow-y-auto p-6">
			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">{$LL.settings_page.headings.sync_settings()}</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">
						{$LL.settings_page.descriptions.sync_settings()}
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
									syncConfig.set(data);
									// Invalidating all in order to refresh the form data (done within the load function)
									invalidateAll();
								}
							}
						}}
					/>
				</div>
			</div>

			<div data-testid={testId("database-management-container")} class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">{$LL.settings_page.headings.db_management()}</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">{$LL.settings_page.descriptions.db_management()}</p>
				</div>

				<div class="w-full basis-2/3">
					<ul data-testid={testId("database-management-list")} class="h-[240px] w-full overflow-y-auto overflow-x-hidden border">
						{#if !importOn}
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
										<span>{file}</span>
									</li>
								{:else}
									<li
										data-file={file}
										data-active={active}
										class="group flex h-16 items-center justify-between px-4 py-3 {active ? 'bg-base-100' : ''}"
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
														title: $LL.common.delete_dialog.title({ entity: file }),
														description: $LL.common.delete_database_dialog.description(),
														type: "delete"
													};
												}}
												on:m-keydown={() => {
													deleteDatabase = { name: file };
													dialogContent = {
														onConfirm: () => {}, // Note: confirm handler is called directly from the form element
														title: $LL.common.delete_dialog.title({ entity: file }),
														description: $LL.common.delete_database_dialog.description(),
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
						{:else}
							<div
								class="flex h-full items-center justify-center border-2 border-dashed border-base-100"
								on:drop={handleDrop}
								role="region"
								aria-label="Drop zone"
								on:dragover={handleDragOver}
							>
								<p>{$LL.settings_page.descriptions.import()}</p>
							</div>
						{/if}
					</ul>

					<div class="flex justify-end gap-x-2 px-4 py-6">
						<button on:click={toggleImport} type="button" class="btn-secondary btn">
							{importOn ? "Cancel" : "Import"}
						</button>
						<button on:click={toggleSelection} type="button" class="btn {!selectionOn ? 'btn-secondary btn-outline' : 'btn-primary'}"
							>Select</button
						>
						<button
							use:melt={$trigger}
							on:m-click={() => {
								dialogContent = {
									onConfirm: () => {}, // Note: confirm handler is called directly from the form element
									title: $LL.common.create_database_dialog.title(),
									description: $LL.common.create_database_dialog.description(),
									type: "create"
								};
							}}
							on:m-keydown={() => {
								dialogContent = {
									onConfirm: () => {}, // Note: confirm handler is called directly from the form element
									title: $LL.common.create_database_dialog.title(),
									description: $LL.common.create_database_dialog.description(),
									type: "create"
								};
							}}
							type="button"
							class="btn-primary btn">{$LL.settings_page.labels.new()}</button
						>
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-6 px-4 pb-20 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">{$LL.settings_page.headings.device_settings()}</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">{$LL.settings_page.descriptions.device_settings()}</p>
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
