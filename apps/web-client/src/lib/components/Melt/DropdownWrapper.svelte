<script lang="ts">
	import { fly } from "svelte/transition";

	import { MoreVertical } from "lucide-svelte";
	import { createDropdownMenu, melt } from "@melt-ui/svelte";
	import { testId } from "@librocco/shared";

	const {
		elements: { menu, item, trigger, separator },
		states: { open }
	} = createDropdownMenu({ positioning: { placement: "bottom-start" }, forceVisible: true });
</script>

<button
	data-testid="dropdown-control"
	data-open={$open}
	use:melt={$trigger}
	class="rounded-md border border-gray-300 bg-white py-[9px] pl-[17px] pr-[15px] hover:bg-gray-100"
>
	<MoreVertical class="border-gray-500" size={20} />
</button>

{#if $open}
	<div
		data-testid={testId("dropdown-menu")}
		use:melt={$menu}
		transition:fly|global={{ duration: 150, y: -10 }}
		class="z-50 min-w-[224px] overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
	>
		<slot separator={$separator} item={$item} />
	</div>
{/if}
