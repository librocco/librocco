<script lang="ts">
	import { initDB } from "./db";
	import { onMount } from "svelte";

	onMount(() => {
		const wasmUrlBase = `http://${window.location.host}/preview/`;
		const wasmUrl = new URL("wa-sqlite-async.wasm", wasmUrlBase).href;

		window["initDB"] = (dbid: string, kind: string) => initDB(dbid, kind, () => wasmUrl);
	});
</script>

<h1 class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-2xl">Use the console</h1>
