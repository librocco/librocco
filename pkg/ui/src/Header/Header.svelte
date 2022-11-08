<script lang="ts">
	import Logo from './Logo.svelte';

	export let title = 'Stock';
	export let currentLocation: string;

	const links = [
		{
			label: 'Stock',
			href: '/inventory/stock'
		},
		{
			label: 'Inbound',
			href: '/inventory/inbound'
		},
		{
			label: 'Outbound',
			href: '/inventory/outbound'
		}
	];
</script>

<header class="w-full px-[70px] bg-gray-900">
	<div class="h-16 border-b border-sky-900 flex items-center ">
		<div class="mr-4">
			<Logo />
		</div>

		<nav class="flex space-x-4">
			{#each links as { label, href }}
				<a
					{href}
					class="
							px-3 py-2 text-sm rounded-md
							{currentLocation === href ? 'bg-teal-500 text-gray-900' : 'text-white hover:text-teal-500'}"
					aria-current={currentLocation === href ? 'page' : 'false'}
				>
					<span>{label}</span>
				</a>
			{/each}
		</nav>
	</div>
	<div class="flex h-24 items-center justify-between">
		<h2 class="text-3xl font-bold leading-7 text-white">
			{title}
		</h2>

		<div class="flex">
			<slot name="actionButton" />
		</div>
	</div>
</header>
