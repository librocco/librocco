<script lang="ts">
	import { onMount } from "svelte";
	import { writable } from "svelte/store";

	import { testId } from "@librocco/shared";
	import { LL } from "@librocco/shared/i18n-svelte";

	import type { PageData } from "./$types";

	import { DEMO_DB_NAME, DEMO_DB_URL, VERSION } from "$lib/constants";

	import { Page } from "$lib/controllers";

	import { syncActive } from "$lib/db";
	import { vfsSupportsOPFS } from "$lib/db/cr-sqlite/core/vfs";
	import { dbCache } from "$lib/db/cr-sqlite/db";
	import { checkOPFSFileExists, deleteDBFromOPFS, fetchAndStoreDBFile } from "$lib/db/cr-sqlite/core/utils";

	import { progressBar } from "$lib/actions";

	import { goto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";

	export let data: PageData;

	$: ({ plugins } = data);
	$: db = data.dbCtx?.db;

	onMount(() => {
		if (!vfsSupportsOPFS(data.dbCtx?.vfs)) {
			throw new Error(`Usage not supported: ${data.dbCtx?.vfs} doesn't support FS transparency`);
		}
	});

	$: ({ settings_page: tSettings } = $LL);

	const demoFetchProgress = writable({ active: false, nProcessed: 0, nTotal: 0 });
	const handleResetDemoDB = async () => {
		// Sanity check: this should be unreachable as we validate the DEMO_DB_URL at build time
		if (!DEMO_DB_URL) {
			throw new Error("DEMO_DB_URL is not set");
		}

		// Remove the existing DB (if any)
		if (await checkOPFSFileExists(DEMO_DB_NAME)) {
			await deleteDBFromOPFS({ dbname: DEMO_DB_NAME, dbCache, syncActiveStore: syncActive }); // await removeOPFS
		}

		await fetchAndStoreDBFile(DEMO_DB_URL, DEMO_DB_NAME, demoFetchProgress);

		goto(appPath("stock"));
	};
</script>

<Page title={tSettings.headings.settings()} view="settings" {db} {plugins}>
	<div slot="main" class="flex h-full w-full flex-col divide-y">
		<div class="p-4">
			<h4>{tSettings.stats.version()} {VERSION}</h4>
		</div>

		<div class="flex h-full flex-col flex-wrap space-y-12 overflow-y-auto p-6">
			<div data-testid={testId("database-management-container")} class="flex min-h-[320px] flex-wrap gap-6 px-4 md:flex-row">
				<div class="w-full">
					<h2 class="text-base font-semibold leading-7 text-gray-900">{tSettings.headings.demo_reset()}</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">{tSettings.descriptions.demo_reset_1()}</p>
					<p class="mt-1 text-sm leading-6 text-gray-600">{tSettings.descriptions.demo_reset_2()}</p>
				</div>

				<div class="mb-8 h-3 w-full overflow-hidden rounded">
					<div use:progressBar={demoFetchProgress} class="h-full bg-cyan-300"></div>
				</div>

				<div class="flex w-full justify-end gap-x-2 px-4 py-6">
					<button on:click={handleResetDemoDB} type="button" class="btn-secondary btn">{tSettings.demo_actions.reset_db()}</button>
				</div>
			</div>
		</div>
	</div>
</Page>
