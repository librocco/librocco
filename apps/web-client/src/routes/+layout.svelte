<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";

	import { onMount } from "svelte";
	import { Subscription } from "rxjs";

	import type { LayoutData } from "./$types";
	import { goto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";
	import { browser } from "$app/environment";

	export let data: LayoutData & { status: boolean };

	const { db, status } = data;

	$: {
		// Register (and update on each change) the db to the window object.
		// This is used for e2e tests (easier setup through direct access to the db).
		// This is not a security concern as the db is in the user's browser anyhow.
		if (browser && db) {
			window["db_ready"] = true;
			window["_db"] = db;
			window.dispatchEvent(new Event("db_ready"));
		}
		// This shouldn't affect much, but is here for the purpose of exhaustive handling
		if (browser && !db) {
			window["db_ready"] = false;
			window["_db"] = undefined;
		}
	}

	let availabilitySubscription: Subscription;

	onMount(async () => {
		if (!status) {
			await goto(appPath("settings"));
		}
	});

	export function onDestroy() {
		availabilitySubscription && availabilitySubscription.unsubscribe();
	}
</script>

<slot />

<style global>
	:global(body) {
		height: 100%;
		padding: 0;
		margin: 0;
		overflow-y: hidden;
	}
</style>
