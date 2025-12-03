<script lang="ts">
	import { invalidateAll } from "$app/navigation";

	import LL from "@librocco/shared/i18n-svelte";

	import type { PluginsInterface } from "$lib/plugins";
	import { createExtensionAvailabilityStore, syncConnectivityMonitor } from "$lib/stores";
	import { updateTranslationOverrides, translationOverridesStore, TRANSLATION_OVERRIDES_ENABLED } from "$lib/i18n-overrides";

	export let plugins: PluginsInterface;

	const { connected: syncConnected } = syncConnectivityMonitor;
	$: extensionAvailable = createExtensionAvailabilityStore(plugins);

	async function updateTranslationsButtonClicked() {
		await updateTranslationOverrides({ notOlderThanSecs: 0 });
		invalidateAll();
	}
</script>

<div class="flex items-center gap-4 py-1.5">
	{#if TRANSLATION_OVERRIDES_ENABLED}
		<button on:click={updateTranslationsButtonClicked} class="badge-content badge-outline badge badge-md gap-x-2">
			<div class="block h-3 w-3 rounded-full align-baseline {$translationOverridesStore.loading ? 'bg-error' : 'bg-success'}"></div>
			<p class="leading-none">{$LL.misc_components.extension_banner.reload_translations_override()}</p>
		</button>
	{/if}
	<div class="badge-content badge-outline badge badge-md gap-x-2">
		<div class="block h-3 w-3 rounded-full align-baseline {$extensionAvailable ? 'bg-success' : 'bg-error'}"></div>

		<p class="leading-none">{$LL.misc_components.extension_banner.book_data_extension()}</p>
	</div>
	<div class="badge-content badge-outline badge badge-md gap-x-2">
		<div class="block h-3 w-3 rounded-full align-baseline {$syncConnected ? 'bg-success' : 'bg-error'}"></div>
		<p class="leading-none">{$LL.misc_components.extension_banner.remote_db()}</p>
	</div>
</div>
