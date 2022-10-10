<script lang="ts">
	import type { SvelteComponentDev } from 'svelte/internal';

	export let label = '';
	export let Icon: typeof SvelteComponentDev | null = null;
</script>

<div class="relative inline-block text-left">
	<div class="hidden md:block">
		<button
			type="button"
			class="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
			id="menu-button"
			aria-expanded="true"
			aria-haspopup="true"
		>
			<div class="w-6 pr-1"><svelte:component this={Icon} /></div>
			{label}
			<svg
				class="-mr-1 ml-2 h-5 w-5"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	</div>

	<div class="md:hidden">
		<button
			type="button"
			class="flex items-center rounded-full bg-gray-100 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
			id="menu-button"
			aria-expanded="true"
			aria-haspopup="true"
		>
			<span class="sr-only">Open options</span>
			<!-- Heroicon name: mini/ellipsis-vertical -->
			<svg
				class="h-5 w-5"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z"
				/>
			</svg>
		</button>
	</div>
</div>
