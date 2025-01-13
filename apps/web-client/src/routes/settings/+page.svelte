<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";
	import { get } from "svelte/store";
	import { Search, Download, Trash } from "lucide-svelte";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { zod } from "sveltekit-superforms/adapters";

	import { testId, addSQLite3Suffix } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { appPath } from "$lib/paths";

	import { dbName, dbNamePersisted, resetDB } from "$lib/db";

	import { SettingsForm, DatabaseDeleteForm, databaseCreateSchema, DatabaseCreateForm } from "$lib/forms";
	import { Page, ExtensionAvailabilityToast } from "$lib/components";

	import { dialogDescription, dialogTitle, type DialogContent } from "$lib/dialogs";

	import { VERSION } from "$lib/constants";
	import { goto } from "$lib/utils/navigation";
	import { invalidateAll } from "$app/navigation";
	import { settingsSchema } from "$lib/schemas";
	import { settingsStore } from "$lib/stores/app";

	export let data: PageData;

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
	const handleSelect = (name: string) => async () => {
		// Persist the selection
		dbNamePersisted.set(name);
		// Reset the db (allowing the root load function to reinstantiate the db)
		resetDB();
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
		if (!files.includes(addSQLite3Suffix(get(dbNamePersisted)))) {
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

<Page view="settings" loaded={true}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<h1 class="text-2xl font-bold leading-7 text-gray-900">Settings</h1>
		<h4>Version {VERSION}</h4>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<div class="space-y-12 p-6">
			<div data-testid={testId("database-management-container")} class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Database management</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Use this section to create, select, import, export or delete a database</p>
				</div>
				<div class="w-full basis-2/3">
					<ul data-testid={testId("database-management-list")} class="h-[240px] w-full overflow-y-auto overflow-x-hidden border">
						{#if !importOn}
							{#each files as file (file)}
								{@const active = addSQLite3Suffix(file) === addSQLite3Suffix($dbName)}
								{#if selectionOn}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<li
										on:click={handleSelect(file)}
										data-active={active}
										class="group flex h-16 cursor-pointer items-center justify-between py-3 px-4 {active
											? 'bg-green-300'
											: 'hover:bg-gray-50'}"
									>
										<span>{file}</span>
									</li>
								{:else}
									<li
										data-file={file}
										data-active={active}
										class="group flex h-16 items-center justify-between py-3 px-4 {active ? 'bg-gray-100' : ''}"
									>
										<span>{file}</span>
										<div class="hidden gap-x-2 group-hover:flex">
											<button
												data-testid={testId("db-action-export")}
												on:click={handleExportDatabase(file)}
												type="button"
												class="button cursor-pointer"><Download /></button
											>
											<button
												data-testid={testId("db-action-delete")}
												use:melt={$trigger}
												on:m-click={() => {
													deleteDatabase = { name: file };
													dialogContent = {
														onConfirm: () => {}, // Note: confirm handler is called directly from the form element
														title: dialogTitle.delete(file),
														description: dialogDescription.deleteDatabase(),
														type: "delete"
													};
												}}
												on:m-keydown={() => {
													deleteDatabase = { name: file };
													dialogContent = {
														onConfirm: () => {}, // Note: confirm handler is called directly from the form element
														title: dialogTitle.delete(file),
														description: dialogDescription.deleteDatabase(),
														type: "delete"
													};
												}}
												type="button"
												class="button cursor-pointer"><Trash /></button
											>
										</div>
									</li>
								{/if}
							{/each}
						{:else}
							<div
								class="flex h-full items-center justify-center border-2 border-dashed border-gray-300"
								on:drop={handleDrop}
								role="region"
								aria-label="Drop zone"
								on:dragover={handleDragOver}
							>
								<p>Drag and drop your .sqlite3 file here to import</p>
							</div>
						{/if}
					</ul>
					<div class="flex justify-end gap-x-2 px-4 py-6">
						<button on:click={toggleImport} type="button" class="button button-white">
							{importOn ? "Cancel" : "Import"}
						</button>
						<button on:click={toggleSelection} type="button" class="button {!selectionOn ? 'button-white' : 'button-green'}">Select</button>
						<button
							use:melt={$trigger}
							on:m-click={() => {
								dialogContent = {
									onConfirm: () => {}, // Note: confirm handler is called directly from the form element
									title: dialogTitle.createDatabase(),
									description: dialogDescription.createDatabase(),
									type: "create"
								};
							}}
							on:m-keydown={() => {
								dialogContent = {
									onConfirm: () => {}, // Note: confirm handler is called directly from the form element
									title: dialogTitle.createDatabase(),
									description: dialogDescription.createDatabase(),
									type: "create"
								};
							}}
							type="button"
							class="button button-green">New</button
						>
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Connection settings</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Manage connections to services and devices</p>
				</div>
				<div class="w-full basis-2/3">
					<SettingsForm
						data={data.form}
						options={{
							SPA: true,
							dataType: "json",
							validators: zod(settingsSchema),
							validationMethod: "submit-only",
							onUpdated: ({ form }) => {
								if (form.valid) {
									settingsStore.set({ defaultSettings: form.data });
									// Force reload the layout. A simple "invalidation" will not suffice as the existing DB reference will still exist
									window.location.reload();
								}
							}
						}}
					/>
				</div>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>

<div use:melt={$portalled}>
	{#if $open}
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 100 }} />
		{@const { type, title: dialogTitle, description: dialogDescription } = dialogContent};

		{#if type === "create"}
			<div
				class="fixed left-[50%] top-[50%] z-50 flex max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col gap-y-8 rounded-md bg-white py-6 px-4"
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
	{/if}
</div>
