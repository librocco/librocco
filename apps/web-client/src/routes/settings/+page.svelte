<script lang="ts">
	import { Search, Download, Trash } from "lucide-svelte";
	import { onMount } from "svelte";

	import { goto } from "$lib/utils/navigation";

	import { currentDB, select } from "$lib/db";

	import { SettingsForm } from "$lib/forms";
	import { Page, ExtensionAvailabilityToast } from "$lib/components";

	import { appPath } from "$lib/paths";
	import { settingsSchema } from "$lib/forms";
	import { settingsStore } from "$lib/stores";

	import type { PageData } from "./$types";
	import { testId } from "@librocco/shared";

	export let data: PageData;

	let files: string[] = [];

	let selection = false;
	const toggleSelection = () => (selection = !selection);

	const createFile = async () => {
		const dir = await window.navigator.storage.getDirectory();

		const ts = Number(new Date()) % 1000000;
		const fname = `file-${ts}.txt`;

		const file = await dir.getFileHandle(fname, { create: true });

		const writable = await file.createWritable();

		await writable.write("Hello world");
		await writable.close();

		files = await getFiles();
	};

	const getFiles = async () => {
		return window.navigator.storage.getDirectory().then(async (dir) => {
			const files = [] as string[];
			for await (const [name] of (dir as any).entries() as AsyncIterableIterator<[string, FileSystemHandle]>) {
				files.push(name);
			}
			return files;
		});
	};

	const handleSelect = (name: string) => () => (select(name), (selection = false));

	const handleDownload = (name: string) => async () => {
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

	const handleDelete = (name: string) => async () => {
		const dir = await window.navigator.storage.getDirectory();
		await dir.removeEntry(name);
		files = await getFiles();
	};

	onMount(async () => {
		files = await getFiles();
	});
</script>

<Page view="settings" loaded={true}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<h1 class="text-2xl font-bold leading-7 text-gray-900">Settings</h1>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<div class="space-y-12 p-6">
			<div data-testid={testId("database-management-container")} class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Database management</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Use this section to create, select, import, export or delete a database</p>
				</div>
				<div class="w-full basis-2/3">
					<ul data-testid={testId("database-management-list")} class="max-h-[240px] w-full overflow-y-auto overflow-x-hidden border">
						{#each files as file}
							{@const active = file === $currentDB}
							{#if selection}
								<li
									data-active={active}
									on:click={handleSelect(file)}
									class="group flex h-16 cursor-pointer items-center justify-between py-3 px-4 {active
										? 'bg-green-300'
										: 'hover:bg-gray-50'}"
								>
									<span>{file}</span>
								</li>
							{:else}
								<li data-active={active} class="group flex h-16 items-center justify-between py-3 px-4 {active ? 'bg-gray-100' : ''}">
									<span>{file}</span>
									<div class="hidden gap-x-2 group-hover:flex">
										<button
											data-testid={testId("db-action-export")}
											on:click={handleDownload(file)}
											type="button"
											class="button cursor-pointer"><Download /></button
										>
										<button
											data-testid={testId("db-action-delete")}
											on:click={handleDelete(file)}
											type="button"
											class="button cursor-pointer"><Trash /></button
										>
									</div>
								</li>
							{/if}
						{/each}
					</ul>
					<div class="flex justify-end gap-x-2 px-4 py-6">
						<button on:click={toggleSelection} type="button" class="button {!selection ? 'button-white' : 'button-green'}">Select</button>
						<button on:click={createFile} type="button" class="button button-green">New</button>
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
						form={data.form}
						options={{
							SPA: true,
							dataType: "json",
							validators: settingsSchema,
							validationMethod: "submit-only",
							onUpdated: ({ form }) => {
								if (form.valid) {
									settingsStore.set(form.data);
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
