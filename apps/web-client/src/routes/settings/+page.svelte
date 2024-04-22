<script lang="ts">
	import { Search } from "lucide-svelte";

	import { goto } from "$app/navigation";

	import { Page, RemoteDbData, ProgressBar } from "$lib/components";
	import { RemoteDbForm, type RemoteDbFormOptions } from "$lib/forms";

	import { remoteDbStore } from "$lib/stores";

	import { appPath } from "$lib/paths";
	import { remoteDbSchema } from "$lib/forms";

	const onUpdated: RemoteDbFormOptions["onUpdated"] = ({ form }) => {};
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
					<!-- <RemoteDbData config={$config} status={replicationStatusMessages[$status.state]} onEdit={() => remoteDbStore.destroyHandler()}>
							
						</RemoteDbData> -->
					<RemoteDbForm
						data={{}}
						options={{
							SPA: true,
							dataType: "json",
							validators: remoteDbSchema,
							validationMethod: "submit-only",
							onUpdated
						}}
					/>
				</div>
			</div>
		</div>
	</svelte:fragment>
</Page>
