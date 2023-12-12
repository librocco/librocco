<script lang="ts">
	import { MoreVertical } from "lucide-svelte";

	let open = false;

	const toggleOpen = () => (open = !open);
</script>

<div class="relative">
	<button on:click={toggleOpen} class="rounded-md border border-gray-300 bg-white py-[9px] pl-[17px] pr-[15px]"
		><MoreVertical class="border-gray-500" size={20} /></button
	>

	{#if open}
		<div
			class="absolute -bottom-3 right-0 z-50 min-w-[224px] translate-y-full overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
		>
			<slot />
		</div>
	{/if}
</div>
