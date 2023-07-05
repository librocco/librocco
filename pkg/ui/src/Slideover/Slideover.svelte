<script lang="ts">
	import { X } from "lucide-svelte";
	import type { MouseEventHandler } from "svelte/elements";

	import { slide } from "svelte/transition";
	export let title: string;
	export let description: string;
	export let handleClose: MouseEventHandler<HTMLButtonElement>;
</script>

<div out:slide={{ axis: "x", duration: 300 }} class="animate-unknown flex max-w-2xl flex-col shadow-lg">
	<div class="flex items-start justify-between bg-gray-50 px-6 py-6">
		<div class="flex flex-col gap-y-2">
			<p class="text-xl font-normal text-gray-900">
				{title}
			</p>
			<p class="text-base font-light text-gray-400">
				{description}
			</p>
		</div>
		<button class="text-gray-400 hover:text-gray-800" type="button" aria-label={`Close dialog ${title}`} on:click={handleClose}>
			<span aria-hidden="true">
				<X />
			</span>
		</button>
	</div>
	<div class="bg-white">
		<slot />
	</div>
</div>

<style>
	@keyframes slider {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0px);
			opacity: 1;
		}
	}

	.animate-unknown {
		animation: slider 300ms ease-in-out;
	}
</style>
