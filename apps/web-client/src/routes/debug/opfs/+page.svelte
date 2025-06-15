<script lang="ts">
	import { initDB } from "./db";
	import { WorkerDBInterface } from "./client";

	import DBWorker from "./worker.ts?worker";
	import { onMount } from "svelte";

	onMount(() => {
		const worker = new DBWorker();

		const wasmUrlBase = `http://${window.location.host}/preview/`;
		const wasmUrl = new URL("wa-sqlite-async.wasm", wasmUrlBase).href;

		window["initDB"] = (dbid: string, kind: string) => initDB(dbid, kind, () => wasmUrl);
		window["db_worker"] = new WorkerDBInterface(worker, wasmUrl);
	});
</script>

<h1 class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-2xl">Use the console</h1>
