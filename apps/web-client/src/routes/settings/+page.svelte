<script lang="ts">
	import { Search } from "lucide-svelte";
	import { zod } from "sveltekit-superforms/adapters";
	import { Download } from "lucide-svelte";
	import JSONbig from "json-bigint";

	import { testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { appPath } from "$lib/paths";

	import { dbid, syncConfig, syncActive } from "$lib/db";

	import { DeviceSettingsForm, SyncSettingsForm } from "$lib/forms";
	import { deviceSettingsSchema, syncSettingsSchema } from "$lib/forms/schemas";
	import { Page, ExtensionAvailabilityToast } from "$lib/components";

	import { VERSION } from "$lib/constants";
	import { goto } from "$lib/utils/navigation";

	import { deviceSettingsStore } from "$lib/stores/app";

	import { createOutboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import { dumpJSONData, dumpSQLData, loadJSONData } from "$lib/db/cr-sqlite/import_export";

	export let data: PageData;

	$: db = data.dbCtx?.db;

	$: plugins = data.plugins;

	// NOTE: This is TEMP until we implement DB selection functionality
	$: files = [$dbid];

	// #region import/export
	let importOption: "json" | "sql" | "" = "";
	const importJSON = () => (importOption = "json");
	const importSQL = () => (importOption = "sql");
	const importOff = () => (importOption = "");

	const handleDragOver = (event: DragEvent) => {
		event.preventDefault();
	};

	const handleDrop = async (event: DragEvent) => {
		event.preventDefault();
		if (event.dataTransfer?.items) {
			for (const item of event.dataTransfer.items) {
				if (item && item.kind === "file") {
					const file = item.getAsFile();
					if (file) await handleImportData(file);
				}
			}
		} else if (event.dataTransfer?.files) {
			for (const file of event.dataTransfer.files) {
				if (file) await handleImportData(file);
			}
		}

		importOff();
	};

	const handleImportData = async (file: File) => {
		if (importOption === "json") {
			const data = JSONbig.parse(await file.text());
			return await loadJSONData(db, data, "data_only");
		}
		if (importOption === "sql") {
			const sql = await file.text();
			return await db.exec(sql);
		}
		throw new Error("Invalid import option: this should be unreachable and indicates a bug in the code");
	};

	const handleExportDatabase = (name: string, format: "json" | "sql") => async () => {
		// Create a blob of JSON data
		let blob: Blob;
		if (format === "json") {
			const data = await dumpJSONData(db, "user_only");
			blob = new Blob([JSONbig.stringify(data)], { type: "application/json" });
		} else {
			const data = await dumpSQLData(db, "user_only", "data_only");
			blob = new Blob([data]);
		}

		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${name}.${format}`;
		a.click();
		URL.revokeObjectURL(url);
		document.removeChild(a);
	};
	// #endregion import/export

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateOutboundNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);
		await goto(appPath("outbound", id));
	};
</script>

<Page {handleCreateOutboundNote} view="settings" loaded={true}>
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
			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Sync settings</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">
						Manage DB name, sync URL and the connection. Note: This will be merged with DB selection in the future
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
								}
							}
						}}
					/>
				</div>
			</div>

			<div data-testid={testId("database-management-container")} class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Database management</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Use this section to create, select, import, export or delete a database</p>
				</div>

				<div class="w-full basis-2/3">
					<ul data-testid={testId("database-management-list")} class="h-[240px] w-full overflow-y-auto overflow-x-hidden border">
						{#if importOption === "json"}
							<div
								class="flex h-full items-center justify-center border-2 border-dashed border-gray-300"
								on:drop={handleDrop}
								role="region"
								aria-label="Drop zone"
								on:dragover={handleDragOver}
							>
								<p>Drag and drop your .json file here to import</p>
							</div>
						{:else if importOption === "sql"}
							<div
								class="flex h-full items-center justify-center border-2 border-dashed border-gray-300"
								on:drop={handleDrop}
								role="region"
								aria-label="Drop zone"
								on:dragover={handleDragOver}
							>
								<p>Drag and drop your .sql file here to import</p>
							</div>
						{:else}
							{#each files as file (file)}
								{@const active = true}
								<li
									data-file={file}
									data-active={active}
									class="group flex h-16 items-center justify-between px-4 py-3 {active ? 'bg-gray-100' : ''}"
								>
									<span>{file}</span>
									<div class="flex gap-x-2">
										<button
											data-testid={testId("db-action-export")}
											on:click={handleExportDatabase(file, "json")}
											type="button"
											class="button cursor-pointer"><Download /> JSON</button
										>
										<button
											data-testid={testId("db-action-export")}
											on:click={handleExportDatabase(file, "sql")}
											type="button"
											class="button cursor-pointer"><Download /> SQL</button
										>
									</div>
								</li>
							{/each}
						{/if}
					</ul>

					<div class="flex justify-end gap-x-2 px-4 py-6">
						{#if importOption === ""}
							<button on:click={importJSON} type="button" class="button button-white">Import JSON</button>
							<button on:click={importSQL} type="button" class="button button-white">Import SQL</button>
						{:else}
							<button on:click={importOff} type="button" class="button button-white">Cancel</button>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Device settings</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Manage connections to external devices</p>
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
								}
							}
						}}
					/>
				</div>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast {plugins} />
	</svelte:fragment>
</Page>
