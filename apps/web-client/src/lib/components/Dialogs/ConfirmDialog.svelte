<script lang="ts">
	import { fade } from "svelte/transition";
	import { expoInOut } from "svelte/easing";
	import Save from "$lucide/save";

	import { melt } from "@melt-ui/svelte";
	import type { Dialog } from "@melt-ui/svelte";
	import { clickOutside } from "$lib/actions";

	export let title: string;
	export let description: string;
	export let dialog: Dialog;

	export let onConfirm: () => void;
	export let onCancel: () => void;

	export let labels: Partial<Record<"cancel" | "confirm", string>> = {};

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
			class="fixed left-1/2 top-1/2 z-[200] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto px-4 md:max-w-lg md:px-0"
			transition:fade={{ duration: 250, easing: expoInOut }}
			use:melt={$content}
			use:clickOutside={onCancel}
		>
			<div class="modal-box overflow-clip rounded-lg md:shadow-2xl">
				<div class="flex w-full flex-col justify-between pr-16">
					{#if title}
						<div class="prose">
							<h3 use:melt={$titleStore}>
								{title}
							</h3>
						</div>
					{/if}
				</div>

				<p class="w-full p-6" use:melt={$desciptionStore}>{description}</p>

				<div class="stretch flex w-full gap-x-4 p-6">
					<div class="basis-fit">
						<button on:click={onCancel} class="btn-secondary btn-outline btn-lg btn" type="button">{labels.cancel}</button>
					</div>
					<div class="grow">
						<button on:click={onConfirm} class="btn-primary btn-lg btn w-full">
							<Save aria-hidden="true" focusable="false" size={20} />
							{labels.confirm}
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
