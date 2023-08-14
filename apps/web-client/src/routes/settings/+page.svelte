<script lang="ts">
	import { base } from "$app/paths";

	import { Header, InventoryPage, RemoteDbForm, RemoteDbData } from "@librocco/ui";

	import { links } from "$lib/data";
	import { remoteDbStore } from "$lib/stores";

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
						data={{ ...$replicator.config, status: $replicator.status.state }}
						onEdit={() => remoteDbStore.destroyHandler(replicator)}
					/>
				{:else}
					<RemoteDbForm 
						onSubmit={(values) => remoteDbStore.createHandler(values)}
					/>
				{/if}
			</div>
		</div>
	</div>
</InventoryPage>
