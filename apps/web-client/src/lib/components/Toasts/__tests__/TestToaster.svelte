<script lang="ts">
	import { toasters } from "../toaster";

	export let toasterId: string;

	const { toaster } = toasters.get(toasterId);
</script>

{#each $toaster as toast}
	<span>{toast.message}</span>
{/each}
