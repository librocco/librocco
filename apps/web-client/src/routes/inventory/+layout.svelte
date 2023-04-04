<script>
	import { onMount } from "svelte";

	import { Header, InventoryPage } from "@librocco/ui";
	import { DB_NAME, COUCHDB_HOST, COUCHDB_PORT, COUCHDB_USER, COUCHDB_PASSWORD } from "$lib/constants";

	import { getDB } from "$lib/db";

	const db = getDB();
	let replicating = db ? true : false;

	onMount(() => {
		// If COUCHDB_HOST is provided, we can assume the remote db is there and at least try to replicate.
		// No point otherwise.
		//
		// TODO: This will be set by the user in the future (probably read from local storage).
		if (!COUCHDB_HOST) {
			return;
		}

		replicating = true;

		db.replicate()
			// Do a db sync first
			.sync(
				{ name: "[INITIAL_SYNC]", debug: false },
				`http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COUCHDB_HOST}:${COUCHDB_PORT}/${DB_NAME}`
			)
			.promise()
			.then(() => {
				replicating = false;
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
{#if !replicating}
	<slot />
{:else}
	<InventoryPage>
		<Header slot="header" currentLocation="/" links={[]} />
		<h1 slot="table" class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl capitalize text-gray-400">
			Replicating...
		</h1>
	</InventoryPage>
{/if}
