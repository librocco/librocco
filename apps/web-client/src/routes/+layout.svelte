<script lang="ts">
	import { readableFromStream } from "$lib/utils/streams";
	import type { DBInitState } from "@librocco/db";
	import { Header, InventoryPage } from "@librocco/ui";

	// Import main.css in order to generate tailwind classes used in the app
	import "../main.css";

	import type { LayoutData } from "./$types";

	export let data: LayoutData;

	$: db = data.db;
	$: initState = readableFromStream({}, db?.stream().initState({}), { state: "void", withReplication: false });
</script>

<!-- We're returning <slot /> if db doesn't initialise (it's "void") in case of SSR env or if the db is fully initialised -->
{#if ["ready", "void", "initialising"].includes($initState.state)}
	<slot />
{:else}
	<InventoryPage>
		<Header slot="header" currentLocation="/" links={[]} />
		<h1 slot="table" class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl capitalize text-gray-400">
			{$initState.state}...
		</h1>
	</InventoryPage>
{/if}
