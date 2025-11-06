<!-- src/routes/+error.svelte -->
<script lang="ts">
	import { page } from "$app/stores";

	import ErrorView from "$lib/components/ErrorView.svelte";
</script>

<ErrorView source="load" message={$page.error.message} />
