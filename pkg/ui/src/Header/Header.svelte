<script lang="ts">
	import Logo from './Logo.svelte';
	export let title = 'Stock';
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
	export let currentUrl = 'stock';
</script>

<div class="bg-gray-900 p-10 pt-5 ">
	<div class="border-b border-sky-900 pb-5 flex sm:items-center ">
		<Logo />

		<div class="pl-4">
			<nav class="flex space-x-4">
				{#each links as { label, href }}
					<a
						{href}
						class={[
							'px-3 py-2 text-sm rounded-md',
							currentUrl === label.toLowerCase()
								? 'bg-teal-500 text-gray-900'
								: 'text-white hover:text-teal-500'
						].join(' ')}
						aria-current={currentUrl === label.toLowerCase() ? 'page' : 'false'}
					>
						<span>{label}</span>
					</a>
				{/each}
			</nav>
		</div>
	</div>
	<div class="mt-2 md:flex md:items-center md:justify-between">
		<div class="min-w-0 flex-1">
			<h2 class="text-3xl font-bold leading-7 text-white">
				{title}
			</h2>
		</div>
		<div class="mt-4 pt-4 flex flex-shrink-0 md:mt-0 md:ml-4">
			<slot name="actionButton" />
		</div>
	</div>
</div>
