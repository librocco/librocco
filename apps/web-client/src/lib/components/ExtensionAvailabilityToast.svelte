<script lang="ts">
	import { getDB } from "$lib/db";
	import { createExtensionAvailabilityStore } from "$lib/stores";

	$: extensionAvailable = createExtensionAvailabilityStore(getDB());
</script>

<div class="ml-auto flex items-center gap-4 py-1.5">
	<p class="leading-none">book data extension</p>
	<div class="block h-3 w-3 rounded-full align-baseline {$extensionAvailable ? 'bg-green-400' : 'bg-red-500'}" />
</div>
