<script lang="ts">
	import { fade } from "svelte/transition";
	import { X } from "lucide-svelte";

	import { consume } from "../Toasts";

	import { ToastType, type Toast } from "./types";

	export let toast: Toast;

	const colourLookup = {
		[ToastType.Error]: "bg-red-50 text-red-900",
		[ToastType.Success]: "bg-green-50 text-green-900"
	};

	const t = consume(toast);
</script>

<div
	class="flex max-w-fit items-center justify-between gap-x-4 rounded-lg px-4 py-2 shadow-md {colourLookup[toast.type]}"
	role="alert"
	transition:fade={{ duration: 200 }}
	use:t.toast
>
	<p class="text-left text-base font-normal">
		{$t.message}
	</p>
	<button
		type="button"
		aria-label="Close toast"
		class="rounded-lg p-1 text-gray-400 hover:text-gray-800 focus:outline-none focus:outline-gray-700"
		on:click={() => t.close()}
	>
		<X />
	</button>
</div>
