<script lang="ts">
	import { Menu, MenuButton, MenuItems, Transition } from "@rgossiaux/svelte-headlessui";
	import { ChevronDown, MoreVertical } from "lucide-svelte";

	import { AlignContainerEdge } from "./enums";

	export let buttonLabel: string;
	export let alignItemsEdge: AlignContainerEdge = AlignContainerEdge.Right;
</script>

<Menu {...$$restProps}>
	<div class="hidden md:block">
		<MenuButton
			class="inline-flex w-full items-center justify-center gap-x-2 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
		>
			{#if $$slots.buttonIcon}
				<slot name="buttonIcon" />
			{/if}
			{buttonLabel}
			<ChevronDown />
		</MenuButton>
	</div>

	<div class="md:hidden">
		<MenuButton
			class="flex items-center rounded-full bg-gray-100 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-100"
		>
			<span class="sr-only">Open {buttonLabel}</span>
			<MoreVertical />
		</MenuButton>
	</div>

	<Transition
		enter="transition ease-out duration-100"
		enterFrom="transform opacity-0 scale-95"
		enterTo="transform opacity-100 scale-100"
		leave="transition ease-in duration-75"
		leaveFrom="transform opacity-100 scale-100"
		leaveTo="transform opacity-0 scale-95"
	>
		<MenuItems
			class="{alignItemsEdge} absolute z-10 mt-2 w-max origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
			as="nav"
		>
			{#if $$slots.items}
				<slot name="items" />
			{/if}
		</MenuItems>
	</Transition>
</Menu>
