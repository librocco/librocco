<script lang="ts">
	import Logo from './Logo.svelte';

	interface HeaderLink {
		label: string;
		href: string;
	}

	export let title = 'Stock';
	export let currentLocation: string;
	export let links = [] as HeaderLink[];
</script>

<header class="w-full bg-gray-900 px-[70px]">
	<div class="flex h-16 items-center border-b border-sky-900 ">
		<div class="mr-4">
			<Logo />
		</div>

		<nav class="flex space-x-4">
			{#each links as { label, href }}
				<a
					{href}
					class="rounded-md px-3 py-2 text-sm {currentLocation === href
						? 'bg-teal-500 text-gray-900'
						: 'text-white hover:text-teal-500'}"
					aria-current={currentLocation === href ? 'page' : 'false'}
				>
					<span>{label}</span>
				</a>
			{/each}
		</nav>
	</div>
	<div class="flex h-24 items-center justify-between">
		<h1 class="text-3xl font-bold leading-7 text-white">
			{title}
		</h1>

		<slot name="actionButton" />
	</div>
</header>
