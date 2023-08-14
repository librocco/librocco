<script lang="ts">
	import { base } from "$app/paths";

	import { Header, InventoryPage, RemoteDbForm, RemoteDbData, ProgressBar } from "@librocco/ui";

	import { links } from "$lib/data";
	import { remoteDbStore } from "$lib/stores";
	import { replicationStatusMessages } from "$lib/toasts";


	$: ({ replicator } = $remoteDbStore);
	$: status = replicator && replicator.status;
	$: config = replicator && replicator.config;
	$: progress = replicator && replicator.progress;
</script>

<InventoryPage>
	<Header {links} currentLocation={`${base}/settings/`} slot="header" />

	<div slot="table" class="space-y-12">
		<div class="flex flex-col sm:flex-row px-16 gap-6">
			<div>
				<h2 class="text-base font-semibold leading-7 text-gray-900">Database settings</h2>
				<p class="mt-1 text-sm leading-6 text-gray-600">
					Manage a connection to a remote database
				</p>
			</div>
			<div class="w-full max-w-3xl">
				{#if replicator}
					<RemoteDbData
						config={$config}
						status={{ 
							color: replicationStatusMessages[$status.state].color,
							message: replicationStatusMessages[$status.state].message
						}}
						onEdit={() => remoteDbStore.destroyHandler(replicator)}
					>
						<div slot="info" class="pt-2 flex flex-col gap-y-2">
							{#if $status.info}
								<p class="text-xs leading-4 font-medium uppercase text-gray-500">{$status.info}</p>
							{:else}
								<ProgressBar value={$progress.progress !== -1 ? $progress.progress : undefined}/>
								<p class="text-xs leading-4 font-medium uppercase text-gray-500">
									{$progress.docsWritten}{$progress.docsPending ? ` / ${$progress.docsPending}` : ""} Documents synced
								</p>
							{/if}
						</div>	
					</RemoteDbData>
				{:else}
					<RemoteDbForm 
						onSubmit={(values) => remoteDbStore.createHandler(values)}
					/>
				{/if}
			</div>
		</div>
	</div>
</InventoryPage>
