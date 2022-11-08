<script lang="ts">
	import { Menu, MenuButton, MenuItems, MenuItem, Transition } from '@rgossiaux/svelte-headlessui';
	import { ChevronDown, MoreVertical } from 'lucide-svelte';

	import { classNames } from '../utils/styles';

	import { AlignContainerEdge } from './enums';

	export let buttonLabel: string;
	export let items: { label: string; href: string; onClick?: () => void }[];
	export let alignItemsEdge: AlignContainerEdge = AlignContainerEdge.Right;

	const baseButtonClasses = ['focus:ring-offset-2', 'focus:ring-teal-500', 'focus:ring-2', 'focus:outline-none'].join(
		' '
	);

	const smallButtonClasses = [
		baseButtonClasses,
		'flex',
		'items-center',
		'rounded-full',
		'bg-gray-100',
		'text-gray-400',
		'hover:text-gray-600',
		'focus:ring-offset-gray-100'
	].join(' ');

	const bigButtonClasses = [
		baseButtonClasses,
		'inline-flex',
		'gap-x-2',
		'w-full',
		'justify-center',
		'items-center',
		'rounded-md',
		'border',
		'border-gray-300',
		'bg-white',
		'px-2',
		'py-2',
		'text-sm',
		'font-medium',
		'text-gray-700',
		'shadow-sm',
		'hover:bg-gray-50'
	].join(' ');

	const containerClasses = [
		alignItemsEdge,
		'absolute',
		'w-max',
		'z-10',
		'mt-2',
		'origin-top-right',
		'divide-y',
		'divide-gray-100',
		'rounded-md',
		'bg-white',
		'shadow-lg',
		'ring-1',
		'ring-black',
		'ring-opacity-5',
		'focus:outline-none'
	].join(' ');

	const itemClasses = ['block', 'px-5', 'py-3', 'min-w-fit', 'text-sm'].join(' ');

	const voidMenuItemClick = () => {};
</script>

<Menu>
	<div class="hidden md:block">
		<MenuButton class={bigButtonClasses}>
			{#if $$slots.buttonIcon}
				<slot name="buttonIcon" />
			{/if}
			{buttonLabel}
			<ChevronDown />
		</MenuButton>
	</div>

	<div class="md:hidden">
		<MenuButton class={smallButtonClasses}>
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
		<MenuItems class={containerClasses} as="nav">
			{#each items as { label, href, onClick = voidMenuItemClick }, ix (ix)}
				<MenuItem let:active {href} on:click={onClick}>
					<span
						class={classNames(
							itemClasses,
							active ? 'bg-teal-200 text-gray-700' : 'bg-white text-gray-900',
							ix === 0 ? 'rounded-t-md' : '',
							ix === items.length - 1 ? 'rounded-b-md' : ''
						)}
					>
						{label}
					</span>
				</MenuItem>
			{/each}
		</MenuItems>
	</Transition>
</Menu>
