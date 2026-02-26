<script lang="ts">
	import type { PageData } from "./$types";

	import Page from "./Page.svelte";

	import { app } from "$lib/app";

	export let data: PageData;
	let { supplierId, pageData } = data;
</script>

<Page {supplierId} {app} {pageData} />
