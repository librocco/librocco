<script lang="ts">
	import { ChevronLeft as SA } from "lucide-svelte";

	import { Button, ButtonColor, Header, InventoryPage } from "$lib/components";

	import { createDB, destroyDB } from "$lib/db";
	import { base } from "$app/paths";

	import { appPath } from "$lib/paths";

	let destroyingDb = false;
	const handleDestroyDB = () => {
		destroyingDb = true;
		destroyDB()
			.then(() => createDB())
			.then(() => {
				destroyingDb = false;
			});
	};
</script>

<InventoryPage>
	<!-- Header slot -->
	<Header currentLocation="/" slot="header" />

	<section class="px-48 pt-14" slot="table">
		<div class="mb-12">
			<a href={appPath("inventory")}>
				<Button color={ButtonColor.White}><SA slot="startAdornment" />Back to inventory</Button>
			</a>
		</div>

		<div class="mb-5 w-3/4 py-5">
			<h2 class="mb-6 text-2xl">Destroy IndexedDB</h2>
			<p class="mb-6 text-gray-500">
				Click here to destroy the db instance. This is a convenience action to avoid having to manually delete the IndexedDB, which can,
				sometimes, cause problems with Chrome's storage for the route. <br /><br />
				If you wish to reset the db (destroy it and initialise a new instance), you can click this button and then refresh the page (or click
				"Back to inventory" button). This will initialise the new instance of the db and, if the docker dev db is running, populate the db with
				the data pulled from the remote db.
			</p>
			<Button disabled={destroyingDb} class={destroyingDb ? "!bg-gray-200" : ""} on:click={handleDestroyDB}>Destroy IndexedDB</Button>
		</div>

		<div class="separator" />
	</section>
</InventoryPage>

<style lang="postcss">
	.separator {
		@apply mt-6 mb-10 h-px w-[80%] bg-gray-200;
	}
</style>
