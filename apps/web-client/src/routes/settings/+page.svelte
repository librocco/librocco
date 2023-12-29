<script lang="ts">
	import { base } from "$app/paths";

	import { Header, InventoryPage, RemoteDbForm, RemoteDbData, ProgressBar } from "$lib/components";

	import { links } from "$lib/data";
	import { remoteDbStore } from "$lib/stores";
	import { replicationStatusMessages } from "$lib/toasts";

	$: ({ replicator } = remoteDbStore);
	$: ({ status, config, progress, hasActiveHandler } = replicator);
</script>

<InventoryPage>
	<Header {links} currentLocation={`${base}/settings/`} slot="header" />

	<div slot="table" class="space-y-12">
		<div class="flex flex-col gap-6 px-16 sm:flex-row">
			<div>
				<h2 class="text-base font-semibold leading-7 text-gray-900">Database settings</h2>
				<p class="mt-1 text-sm leading-6 text-gray-600">Manage a connection to a remote database</p>
			</div>
			<div class="w-full max-w-3xl">
				{#if $hasActiveHandler}
					<RemoteDbData
						config={$config}
						status={{
							color: replicationStatusMessages[$status.state].color,
							message: replicationStatusMessages[$status.state].message
						}}
						onEdit={() => remoteDbStore.destroyHandler()}
					>
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
					<RemoteDbForm data={$config} onSubmit={(values) => remoteDbStore.createHandler(values)} />
				{/if}
			</div>
		</div>
	</div>
</InventoryPage>
