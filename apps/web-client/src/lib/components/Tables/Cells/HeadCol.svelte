<script lang="ts">
	import type { ComponentType } from "svelte";
	import type { Icon } from "lucide-svelte";

	export let label: string;
	export let icon: ComponentType<Icon> = null;
	export let srOnly = false;
</script>

<span class="inline-flex items-center gap-2">
	<svelte:component this={icon} aria-hidden="true" />
	<span class="whitespace-nowrap text-base font-medium leading-5 text-gray-900" class:sr-only={srOnly}>
		{label}
	</span>
</span>
