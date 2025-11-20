<script lang="ts">
	import type { ActionReturn } from "svelte/action";

	export let action: (node: HTMLTableRowElement) => ActionReturn<any>;
</script>

<tr use:action></tr>
