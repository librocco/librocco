<script lang="ts">
	import { fade } from "svelte/transition";

	import { createPopover, melt, type CreatePopoverProps } from "@melt-ui/svelte";

	export let options: CreatePopoverProps;

	const {
		elements: { trigger, content, arrow, close },
		states: { open }
	} = createPopover(options);
</script>

<slot trigger={$trigger} close={$close} {open} />

{#if $open}
	<div use:melt={$content} transition:fade={{ duration: 100 }} class="z-10 rounded-md bg-gray-900 shadow">
		<div use:melt={$arrow} />
		<slot name="popover-content" />
	</div>
{/if}
