<script lang="ts">
	import { ChevronRight } from "lucide-svelte";

	import type { Breadcrumb } from "./types";

	export let links: Breadcrumb[];
</script>

<nav id="breadcrumbs" {...$$restProps}>
	<ul class="flex select-none items-center gap-2 text-sm font-medium leading-5 text-gray-500">
		{#each links as { label, href }, i}
			{@const isLast = i === links.length - 1}
			{@const hasLink = Boolean(href)}
			<li class="block">
				{#if hasLink}
					<a {href} class="underline-offset-2 hover:underline">{label}</a>
				{:else}
					<div>{label}</div>
				{/if}
			</li>
			{#if !isLast}
				<div class="mx-2 block"><ChevronRight size={20} /></div>
			{/if}
		{/each}
	</ul>
</nav>
