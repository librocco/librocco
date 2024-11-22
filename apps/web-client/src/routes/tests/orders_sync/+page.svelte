<script lang="ts">
	import { onMount } from "svelte";
	import { WorkerInterface } from "@vlcn.io/ws-client";
	import { get } from "svelte/store";
	import { page } from "$app/stores";

	import type { Customer, DB } from "$lib/db/orders/types";

	import { getInitializedDB } from "$lib/db/orders/db";
	import * as local from "$lib/db/orders/customers";
	import * as remote from "$lib/db/orders/customers-remote";

	import SyncWorker from "$lib/db/orders/__tests__/worker.ts?worker";

	let ready = false;

	let db1: DB;
	let db2: DB;

	let db1Customers: Customer[] = [];
	let db2Customers: Customer[] = [];

	onMount(async () => {
		// Start the sync worker - we'll be needing it for the tests
		const _wkr = new SyncWorker();
		const wkr = new WorkerInterface(_wkr);

		// For some reason a path param for (e.g. [room]) doesn't work in production build
		// so we're resorting to URL search params to load the room - this is somewhat brittle, but does the job
		const room = new URL(get(page).url).searchParams.get("room") || "test";

		const dbid1 = [room, "1"].join("-");
		const dbid2 = [room, "2"].join("-");

		window["room"] = room;
		window["url"] = "ws://localhost:3000/sync"; // default: this can be overriden in tests
		window["dbid1"] = dbid1;
		window["dbid2"] = dbid2;

		const _db1 = await getInitializedDB(dbid1);
		const _db2 = await getInitializedDB(dbid2);

		db1 = _db1.db;
		db2 = _db2.db;

		await local.getAllCustomers(db1).then((c) => (db1Customers = c || []));
		await local.getAllCustomers(db2).then((c) => (db2Customers = c || []));

		_db1.rx.onRange(["customer"], () => local.getAllCustomers(db1).then((c) => (db1Customers = c || [])));
		_db2.rx.onRange(["customer"], () => local.getAllCustomers(db2).then((c) => (db2Customers = c || [])));

		window["db1"] = db1;
		window["db2"] = db2;

		// Attach relevand object/handles to the window object so that we
		// can access them within Playwright test (using page.evaluate(...) context)
		window["wkr"] = wkr;
		window["local"] = local;
		window["remote"] = remote;

		// Signal ready (for the test code to await before beginning with interactions)
		ready = true;
	});
</script>

<div class="h-screen w-screen overflow-y-auto p-12">
	<h1 class="my-4">Ready: {ready}</h1>
	<div class="flex min-h-full gap-x-8">
		<div data-testid="db1-customers" class="min-h-full w-full space-y-4 border">
			{#each db1Customers as { id, fullname, email, deposit }}
				<div data-testid="customer-card" class="w-full rounded border p-4">
					<p class="my-2">id: {id}</p>
					<p class="my-2">fullname: {fullname}</p>
					<p class="my-2">email: {email}</p>
					<p class="my-2">deposit: {deposit}</p>
				</div>
			{/each}
		</div>

		<div data-testid="db2-customers" class="min-h-full w-full space-y-4 border">
			{#each db2Customers as { id, fullname, email, deposit }}
				<div data-testid="customer-card" class="w-full rounded border p-4">
					<p class="my-2">id: {id}</p>
					<p class="my-2">fullname: {fullname}</p>
					<p class="my-2">email: {email}</p>
					<p class="my-2">deposit: {deposit}</p>
				</div>
			{/each}
		</div>
	</div>
</div>
