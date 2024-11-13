<script lang="ts">
	import { fade } from "svelte/transition";

	import { melt } from "@melt-ui/svelte";
	import type { Dialog } from "@melt-ui/svelte";
	export let title: string;
	export let description: string;
	export let dialog: Dialog;

	const {
		elements: { portalled, overlay, content, title: titleStore, description: desciptionStore },
		states: { open }
	} = dialog;
</script>

<div {...$portalled} use:portalled>
	{#if $open}
		<div
			class="fixed inset-0 z-[200] h-full w-full overflow-y-auto bg-[#000000]/50"
			{...$overlay}
			use:overlay
			transition:fade={{ duration: 125 }}
		>
			<div
				class="modal-box fixed left-[50%] top-[50%] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto p-0 px-4 md:max-w-md md:px-0"
				{...$content}
				use:content
				role="dialog"
			>
				<h2 class="sr-only" use:melt={$titleStore}>{title}</h2>
				<p class="sr-only" use:melt={$desciptionStore}>{description}</p>

				<slot />
			</div>
		</div>
	{/if}
</div>
