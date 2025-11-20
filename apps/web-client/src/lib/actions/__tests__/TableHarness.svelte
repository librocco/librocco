<script lang="ts">
	import type { ActionReturn } from "svelte/action";

	export let action: (node: HTMLTableElement) => ActionReturn<any>;
</script>

<table use:action></table>
