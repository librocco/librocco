<script lang="ts">
	import { Search } from "lucide-svelte";

	import { goto } from "$app/navigation";

	import { Page, RemoteDbData, ProgressBar, ExtensionAvailabilityToast } from "$lib/components";
	import { RemoteDbForm, type RemoteDbFormOptions } from "$lib/forms";

	import { remoteDbStore } from "$lib/stores";
	import { replicationStatusMessages } from "$lib/toasts";

	import { appPath } from "$lib/paths";
	import { remoteDbSchema } from "$lib/forms";
	import type { ReplicationConfig } from "$lib/stores/replication";

	$: ({ replicator } = remoteDbStore);
	$: ({ status, config, progress, hasActiveHandler } = replicator);

	const onUpdated: RemoteDbFormOptions["onUpdated"] = ({ form }) => {
		const data = form?.data as ReplicationConfig;

		return remoteDbStore.createHandler(data);
	};
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
			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Database settings</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Manage a connection to a remote database</p>
				</div>
				<div class="w-full basis-2/3">
					{#if $hasActiveHandler}
						<RemoteDbData config={$config} status={replicationStatusMessages[$status.state]} onEdit={() => remoteDbStore.destroyHandler()}>
							<div slot="info" class="flex flex-col gap-y-2 pt-2">
								{#if $status.state === "ACTIVE:REPLICATING"}
									<ProgressBar value={$progress.progress !== -1 ? $progress.progress : undefined} />
									<p class="text-xs font-medium uppercase leading-4 text-gray-500">
										{$progress.docsWritten}{$progress.docsPending ? ` / ${$progress.docsWritten + $progress.docsPending}` : ""} Documents synced
									</p>
								{:else if $status.state === "ACTIVE:INDEXING"}
									<ProgressBar />
								{:else}
									<p class="text-xs font-medium uppercase leading-4 text-gray-500">{$status.info}</p>
								{/if}
							</div>
						</RemoteDbData>
					{:else}
						<RemoteDbForm
							data={$config}
							options={{
								SPA: true,
								dataType: "json",
								validators: remoteDbSchema,
								validationMethod: "submit-only",
								onUpdated
							}}
						/>
					{/if}
				</div>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>
