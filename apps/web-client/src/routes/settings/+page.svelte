<script lang="ts">
	import type { EventHandler } from "svelte/elements";
	import { base } from "$app/paths";

	import { Button, TextField, Header, InventoryPage } from "@librocco/ui";

	import { links } from "$lib/data";
	import { remoteCouchConfigStore } from "$lib/stores/settings";

	let errors = {
		"couch-url": ""
	};

	const handleSubmit: EventHandler<Event & { readonly submitter: HTMLElement }, HTMLFormElement> = (event) => {
		const formData = new FormData(event.target as HTMLFormElement);

		const couchUrl = formData.get("couch-url") as string;

		const urlRegex = new RegExp("^(.+):(.+)@(.+):(.+)$");

		if (couchUrl && urlRegex.test(couchUrl)) {
			errors["couch-url"] = "";
			remoteCouchConfigStore.set({ couchUrl });
		} else {
			errors["couch-url"] = "URL should have format <COUCHDB_USER:<COUCHDB_PASSWORD>@<COUCHDB_HOST>:<COUCHDB_PORT>/${DB_NAME}";
		}
	};
</script>

<InventoryPage>
	<Header {links} currentLocation={`${base}/settings/`} slot="header" />

	<div slot="table" class="flex justify-start">
		<div class="flex basis-full flex-col gap-y-4 px-16 lg:basis-2/3">
			<h1 class="text-xl">Database settings</h1>

			<form method="POST" on:submit|preventDefault={handleSubmit}>
				<div class="flex flex-col gap-y-4">
					<TextField
						name="couch-url"
						id="couch-url"
						label="Remote CouchDB URL"
						placeholder="<COUCHDB_USER>:<COUCHDB_PASSWORD>@<COUCHDB_HOST>:<COUCHDB_PORT>/"
						value={$remoteCouchConfigStore?.couchUrl}
						error={errors?.["couch-url"] ? true : false}
						helpText={errors?.["couch-url"] || ""}
						required
					>
						<span
							slot="startAdornment"
							class="inline-flex h-full select-none items-center rounded-l-md border-r-2 border-gray-100 pr-3 text-gray-500 sm:text-sm"
						>
							http://
						</span>
					</TextField>
					<div class="self-end">
						<Button type="submit">Save settings</Button>
					</div>
				</div>
			</form>
		</div>
	</div>
</InventoryPage>
