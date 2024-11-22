<script lang="ts">
	import { onMount } from "svelte";
	import { WorkerInterface } from "@vlcn.io/ws-client";

	import { getInitializedDB } from "$lib/db/orders/db";
	import * as local from "$lib/db/orders/customers";
	import * as remote from "$lib/db/orders/customers-remote";

	import SyncWorker from "$lib/db/orders/__tests__/worker.ts?worker";

	let ready = false;

	onMount(async () => {
		// Start the sync worker - we'll be needing it for the tests
		console.time("worker-init");
		const _wkr = new SyncWorker();
		const wkr = new WorkerInterface(_wkr);
		console.timeEnd("worker-init");

		// Attach relevand object/handles to the window object so that we
		// can access them within Playwright test (using page.evaluate(...) context)
		window["wkr"] = wkr;
		window["getInitializedDB"] = getInitializedDB;
		window["local"] = local;
		window["remote"] = remote;

		console.time("ready-rerender");
		// Signal ready (for the test code to await before beginning with interactions)
		ready = true;
	});

	$: if (ready) console.timeEnd("ready-rerender");
</script>

<div class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2">
	<p class="my-4 max-w-[640px]">
		INFO: Nothing to see here, this page is used exclusively to interact with JS engine within browser context in Playwright tests
	</p>
	<p>Ready: {ready}</p>
</div>
