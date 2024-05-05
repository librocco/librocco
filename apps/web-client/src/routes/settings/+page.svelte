<script lang="ts">
	import { Search } from "lucide-svelte";

	import { goto } from "$app/navigation";

	import { SettingsForm } from "$lib/forms";
	import { Page, ExtensionAvailabilityToast } from "$lib/components";

	import { appPath } from "$lib/paths";
	import { settingsSchema } from "$lib/forms";
	import { settingsStore } from "$lib/stores";

	import type { PageData } from "./$types";

	export let data: PageData;
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
