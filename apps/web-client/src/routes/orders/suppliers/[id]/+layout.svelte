<script lang="ts">
	import { page } from "$app/stores";

	import type { LayoutData } from "./$types";

	import { app } from "$lib/app";

	import Layout from "./Layout.svelte";

	export let data: LayoutData;
	$: ({ supplierId, layoutData, plugins } = data);
</script>

{#if $page.route.id?.includes("new-order")}
	<slot />
{:else}
	<Layout {app} {supplierId} {layoutData} {plugins}>
		<slot />
	</Layout>
{/if}
