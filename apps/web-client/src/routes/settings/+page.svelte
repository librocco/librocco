<script lang="ts">
	import { base } from "$app/paths";

	import { Header, InventoryPage, RemoteDbForm, RemoteDbData, ProgressBar } from "@librocco/ui";

	import { links } from "$lib/data";
	import { remoteDbStore } from "$lib/stores";
	import { replicationStatusMessages } from "$lib/toasts";


	$: ({ replicator } = $remoteDbStore);
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
						config={$replicator.config}
						status={{ 
							color: replicationStatusMessages[$replicator.state].color,
							message: replicationStatusMessages[$replicator.state].message
						}}
						onEdit={() => remoteDbStore.destroyHandler(replicator)}
					>
						<div slot="info" class="pt-2 flex flex-col gap-y-2">
							{#if $replicator.info}
								<p class="text-xs leading-4 font-medium uppercase text-gray-500">{$replicator.info}</p>
							{:else}
								<ProgressBar value={$replicator.progress !== -1 ? $replicator.progress : undefined}/>
								<p class="text-xs leading-4 font-medium uppercase text-gray-500">
									{$replicator.docsWritten}{$replicator.docsPending ? ` / ${$replicator.docsPending}` : ""} Documents synced
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
