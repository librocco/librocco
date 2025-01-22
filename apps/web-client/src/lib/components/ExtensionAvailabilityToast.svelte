<script lang="ts">
	import type { PluginsInterface } from "$lib/plugins";
	import { createDBConnectivityStore, createExtensionAvailabilityStore } from "$lib/stores";

	export let plugins: PluginsInterface;

	$: extensionAvailable = createExtensionAvailabilityStore(plugins);
	$: dbConnectivity = createDBConnectivityStore();
</script>

<div class="width-full flex gap-4 py-1.5">
	<div class="flex items-center gap-4 py-1.5">
		<p class="leading-none">book data extension</p>
		<div class="block h-3 w-3 rounded-full align-baseline {$extensionAvailable ? 'bg-green-400' : 'bg-red-500'}" />
	</div>
	<div class="flex items-center gap-4 py-1.5">
		<p class="leading-none">db connectivity</p>
		<div class="block h-3 w-3 rounded-full align-baseline {$dbConnectivity ? 'bg-green-400' : 'bg-red-500'}" />
	</div>
</div>
