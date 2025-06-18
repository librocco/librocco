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
	class="bg-content btn-sm btn border-base-content hover:bg-base-300 items-center border py-[9px] pl-[17px] pr-[15px]"
>
	<MoreVertical class="border-base-300" size={14} />
</button>

{#if $open}
	<div
		data-testid={testId("dropdown-menu")}
		use:melt={$menu}
		transition:fly|global={{ duration: 150, y: -10 }}
		class="bg-base-100 ring-primary z-50 min-w-[224px] overflow-hidden shadow-lg ring-1 ring-opacity-5"
	>
		<slot separator={$separator} item={$item} />
	</div>
{/if}
