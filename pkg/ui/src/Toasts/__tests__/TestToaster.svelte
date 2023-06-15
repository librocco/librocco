<script lang="ts">
	import { toasters } from "../toaster";

	const { toaster } = toasters.get("default");
</script>

{#each $toaster as toast}
	<span>{toast.message}</span>
{/each}
