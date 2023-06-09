<script lang="ts">
	import { getContext } from "svelte";

	import { TOASTER_CONTEXT_PREFIX } from "../toaster";

	import type { ToasterContext } from "../types";

	const { toaster } = getContext<ToasterContext>(`${TOASTER_CONTEXT_PREFIX}-default`);
</script>

{#each $toaster as toast}
	<span>{toast.message}</span>
{/each}
