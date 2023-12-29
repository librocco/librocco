<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { FilePlus } from "lucide-svelte";

	interface $$Props extends HTMLButtonAttributes {
		label: string;
	}

	export let label: string;
</script>

<button
	on:click
	type="button"
	class="flex w-full items-center justify-between p-4 text-sm font-normal text-gray-400 hover:text-pink-400"
	{...$$restProps}
>
	{label}
	<span aria-hidden="true">
		<FilePlus />
	</span>
</button>
