<script lang="ts">
	import { slide } from "svelte/transition";
	import { expoOut } from "svelte/easing";

	import SidebarItem from "./SidebarItem.svelte";

	interface SidebarItem {
		name: string;
		href: string;
		current: boolean;
	}

	export let name: string;
	export let index: number;

	// Expanded is a value we can bind to and is used to control the expanded
	// state of the group, both from inside the component and outside the component
	export let expanded = false;
	// Expand is used to explicitly expand the group from outside the component
	// setting this to false is a noop, whereas setting it to true will set
	// the 'expanded' value to true, effectively expanding the group
	export let expand = expanded;
	$: expand === true && (expanded = true);

	export let items: SidebarItem[];

	const controlId = `sub-menu-${index}`;

	const buttonBaseClasses = [
		"bg-white",
		"text-gray-600",
		"hover:bg-gray-50",
		"hover:text-gray-900",
		"w-full",
		"flex",
		"items-center",
		"pr-2",
		"py-3",
		"text-left",
		"text-sm",
		"font-normal",
		"focus:outline",
		"focus:outline-teal-500"
	].join(" ");

	$: iconExpandedClasses = expanded ? "text-gray-400 rotate-90" : "text-gray-300";
	$: iconBaseClasses = [
		iconExpandedClasses,
		"h-5",
		"w-5",
		"mr-2",
		"flex-shrink-0",
		"transform",
		"transform-all",
		"duration-150",
		"ease-in-out"
	].join(" ");
</script>

<div id="nav-group-{name.replaceAll(' ', '_').replaceAll(/[\(\)]/g, '')}">
	<button
		type="button"
		class={buttonBaseClasses}
		aria-controls={controlId}
		aria-expanded={expanded}
		on:click={() => (expanded = !expanded)}
	>
		<svg class={iconBaseClasses} viewBox="0 0 20 20" aria-hidden="true">
			<path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
		</svg>

		{name}
	</button>
	{#if expanded}
		<!-- The transition property here was preventing the component (and the page itself) from being dismounted, 
			the '|local' part is the workaround as described in: https://github.com/sveltejs/svelte/issues/6812#issuecomment-934318223 -->
		<div id={controlId} transition:slide|local={{ duration: 200, easing: expoOut }}>
			{#each items as { name, href, current }}
				<SidebarItem {name} {href} {current} nested={true} />
			{/each}
		</div>
		{#if $$slots.actions}
			<div class="ml-7 border-t border-dashed border-gray-300 pr-2">
				<slot name="actions" />
			</div>
		{/if}
	{/if}
</div>
