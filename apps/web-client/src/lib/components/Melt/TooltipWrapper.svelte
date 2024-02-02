<script lang="ts">
	import { fade } from "svelte/transition";

	import { createTooltip, melt, type CreateTooltipProps } from "@melt-ui/svelte";

	export let options: CreateTooltipProps;

	const {
		elements: { trigger, content, arrow },
		states: { open }
	} = createTooltip(options);
</script>

<slot trigger={$trigger} />

{#if $open}
	<div use:melt={$content} transition:fade|global={{ duration: 100 }} class="z-10 rounded-md bg-gray-900 shadow">
		<div use:melt={$arrow} />
		<slot name="tooltip-content" />
	</div>
{/if}
