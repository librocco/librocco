<script lang="ts">
	import { fly } from "svelte/transition";

	import MoreVertical from "$lucide/more-vertical";

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
	class="bg-content btn-sm btn items-center border border-base-content py-[9px] pl-[17px] pr-[15px] hover:bg-base-300"
>
	<MoreVertical class="border-base-300" size={14} />
</button>

{#if $open}
	<div
		data-testid={testId("dropdown-menu")}
		use:melt={$menu}
		transition:fly|global={{ duration: 150, y: -10 }}
		class="z-50 min-w-[224px] overflow-hidden bg-base-100 shadow-lg ring-1 ring-primary ring-opacity-5"
	>
		<slot separator={$separator} item={$item} />
	</div>
{/if}
