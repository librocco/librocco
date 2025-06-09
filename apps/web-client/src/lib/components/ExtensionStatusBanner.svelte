<script lang="ts">
	import type { PluginsInterface } from "$lib/plugins";
	import { createDBConnectivityStore, createExtensionAvailabilityStore } from "$lib/stores";
	import LL from "@librocco/shared/i18n-svelte";

	export let plugins: PluginsInterface;

	$: extensionAvailable = createExtensionAvailabilityStore(plugins);
	$: dbConnectivity = createDBConnectivityStore();
</script>

<div class="flex items-center gap-4 py-1.5">
	<div class="badge-content badge-outline badge badge-md gap-x-2">
		<div class="block h-3 w-3 rounded-full align-baseline {$extensionAvailable ? 'bg-success' : 'bg-error'}"></div>

		<p class="leading-none">{$LL.misc_components.extension_banner.book_data_extension()}</p>
	</div>
	<div class="badge-content badge-outline badge badge-md gap-x-2">
		<div class="block h-3 w-3 rounded-full align-baseline {$dbConnectivity ? 'bg-success' : 'bg-error'}"></div>
		<p class="leading-none">{$LL.misc_components.extension_banner.remote_db()}</p>
	</div>
</div>
