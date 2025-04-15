<script lang="ts">
	import { fade } from "svelte/transition";
	import { expoInOut } from "svelte/easing";
	import { X } from "lucide-svelte";

	import { melt } from "@melt-ui/svelte";
	import type { Dialog } from "@melt-ui/svelte";
	export let title: string;
	export let description: string;
	export let dialog: Dialog;

	const {
		elements: { portalled, overlay, content, title: titleStore, description: desciptionStore, close },
		states: { open }
	} = dialog;
</script>

{#if $open}
	<div use:melt={$portalled}>
		<div
			class="fixed inset-0 z-[200] h-full w-full overflow-y-auto bg-[#000000]/50"
			transition:fade={{ duration: 250, easing: expoInOut }}
			use:melt={$overlay}
		></div>
		<div
			class="fixed left-1/2 top-1/2 z-[200] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto px-4 md:max-w-md md:px-0"
			transition:fade={{ duration: 250, easing: expoInOut }}
			use:melt={$content}
		>
			<div class="modal-box overflow-clip rounded-lg md:shadow-2xl">
				<h2 class="sr-only" use:melt={$titleStore}>{title}</h2>

				<p class="sr-only" use:melt={$desciptionStore}>{description}</p>

				<button use:melt={$close} class="btn btn-ghost btn-outline btn-sm absolute right-8 top-4" aria-label="Close">
					<X size={16} />
				</button>

				<slot />
			</div>
		</div>
	</div>
{/if}
