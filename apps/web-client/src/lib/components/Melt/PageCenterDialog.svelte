<script lang="ts">
	import { fade } from "svelte/transition";
	import { expoInOut } from "svelte/easing";

	import { melt } from "@melt-ui/svelte";
	import type { Dialog } from "@melt-ui/svelte";
	export let title: string;
	export let description: string;
	export let dialog: Dialog;

	const {
		elements: { portalled, overlay, content, title: titleStore, description: desciptionStore },
		states: { open },
	} = dialog;
</script>

{#if $open}
	<div use:melt={$portalled}>
		<div
			class="fixed inset-0 z-[200] h-full w-full overflow-y-auto bg-[#000000]/50"
			transition:fade={{ duration: 250, easing: expoInOut }}
			use:melt={$overlay}
		/>
		<div
			class="fixed left-1/2 top-1/2 z-[200] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto px-4 md:max-w-md md:px-0"
			transition:fade={{ duration: 250, easing: expoInOut }}
			use:melt={$content}
		>
			<div class="overflow-clip rounded-lg bg-white md:shadow-2xl">
				<h2 class="sr-only" use:melt={$titleStore}>{title}</h2>
				<p class="sr-only" use:melt={$desciptionStore}>{description}</p>

				<slot />
			</div>
		</div>
	</div>
{/if}
