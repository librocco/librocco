<script>
	import { onMount } from "svelte";

	import { Header, InventoryPage, ProgressBar } from "@librocco/ui";
	import { DB_NAME, COUCHDB_HOST, COUCHDB_PORT, COUCHDB_USER, COUCHDB_PASSWORD } from "$lib/constants";

	import { getDB } from "$lib/db";

	const db = getDB();

	let replicating = db ? true : false;
	let buildingIndexes = false;

	let progress = 0;

	onMount(() => {
		// If COUCHDB_HOST is provided, we can assume the remote db is there and at least try to replicate.
		// No point otherwise.
		//
		// TODO: This will be set by the user in the future (probably read from local storage).
		if (!COUCHDB_HOST) {
			return;
		}

		replicating = true;

		const r = db
			.replicate()
			// Do a db sync first
			.sync(
				{ name: "[INITIAL_SYNC]", debug: false },
				`http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COUCHDB_HOST}:${COUCHDB_PORT}/${DB_NAME}`
			);

		// Track replication progress
		r.replication.on("change", ({ change: { docs_written: written, pending } }) => {
			const total = written + pending;
			progress = Math.floor((100 * written) / total) / 100;
		});

		r.promise()
			// Once replication is done, query the views to build them
			.then(() => {
				replicating = false;
				buildingIndexes = true;

				return db.buildIndexes();
			})
			// When indexes (views) are built, set up live replication
			.then(() => {
				buildingIndexes = false;

				db.replicate().live(
					{
						name: "[LIVE_SYNC]",
						debug: false
					},
					`http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COUCHDB_HOST}:${COUCHDB_PORT}/${DB_NAME}`
				);
			});
	});
</script>

<!-- We're returning <slot /> if db doesn't initialise (it's "void") in case of SSR env or if the db is fully initialised -->
{#if replicating}
	<InventoryPage>
		<Header slot="header" currentLocation="/" links={[]} />
		<div slot="table" class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
			<h1 class="mb-5 text-2xl capitalize text-gray-400">Replicating...</h1>
			<ProgressBar value={progress} />
		</div>
	</InventoryPage>
{:else if buildingIndexes}
	<InventoryPage>
		<Header slot="header" currentLocation="/" links={[]} />
		<div slot="table" class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
			<h1 class="mb-5 text-2xl capitalize text-gray-400">Building indexes...</h1>
			<ProgressBar />
		</div>
	</InventoryPage>
{:else}
	<slot />
{/if}
