<script lang="ts">
	import { BookCopy } from "lucide-svelte";

	interface HeaderLink {
		label: string;
		href: string;
	}

	export let currentLocation: string;
	export let links = [] as HeaderLink[];
</script>

<header class="w-full bg-gray-900">
	<div class="flex h-[4.5rem] items-center justify-start gap-x-4 border-b border-sky-900 px-16">
		<div>
			<BookCopy color="white" strokeWidth={2} size={36} />
		</div>

		<nav class="flex gap-x-4" aria-label="Main navigation">
			{#each links as { label, href }}
				<a
					{href}
					class="rounded-md px-3 py-2 text-sm {currentLocation === href
						? 'bg-teal-500 text-gray-900'
						: 'text-white hover:text-teal-500'}"
					aria-current={currentLocation === href ? "page" : "false"}
				>
					<span>{label}</span>
				</a>
			{/each}
		</nav>

		<div class="ml-auto">
			<slot />
		</div>
	</div>
</header>
