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
	<div use:melt={$content} transition:fade|global={{ duration: 100 }} class="z-10 bg-secondary shadow">
		<div use:melt={$arrow}></div>
		<slot name="tooltip-content" />
	</div>
{/if}
