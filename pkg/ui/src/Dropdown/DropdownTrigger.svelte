<script lang="ts">
	import { ChevronDown, MoreVertical } from 'lucide-svelte';

	export let visible = false;
	export let label: string;

	const baseButtonClasses = [
		'focus:ring-offset-2',
		'focus:ring-teal-500',
		'focus:ring-2',
		'focus:outline-none'
	].join(' ');

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
</script>

<div class="hidden md:block">
	<button
		type="button"
		class={bigButtonClasses}
		id="menu-button"
		aria-expanded={visible}
		aria-haspopup="true"
		on:click
	>
		{#if $$slots.icon}
			<slot name="icon" />
		{/if}
		{label}
		<ChevronDown />
	</button>
</div>

<div class="md:hidden">
	<button
		type="button"
		class={smallButtonClasses}
		id="menu-button"
		aria-expanded={visible}
		aria-haspopup="true"
		on:click
	>
		<span class="sr-only">Open options</span>
		<MoreVertical />
	</button>
</div>
