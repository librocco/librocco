<script lang="ts">
	import { Search } from "lucide-svelte";

	import { goto } from "$app/navigation";

	import { Page } from "$lib/components";
	import { SettingsForm, type SettingsFormOptions } from "$lib/forms";

	import { appPath } from "$lib/paths";
	import { settingsSchema } from "$lib/forms";

	const onUpdated: SettingsFormOptions["onUpdated"] = ({ form }) => {};
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
						data={{}}
						options={{
							SPA: true,
							dataType: "json",
							validators: settingsSchema,
							validationMethod: "submit-only",
							onUpdated
						}}
					/>
				</div>
			</div>
		</div>
	</svelte:fragment>
</Page>
