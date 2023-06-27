<script lang="ts">
	import type { EventHandler } from "svelte/elements";
	import { base } from "$app/paths";

	import { Button, TextField, Header, InventoryPage } from "@librocco/ui";

	import { links } from "$lib/data";
	import { remoteCouchConfigStore } from "$lib/stores/settings";
	import { toastSuccess } from "$lib/toasts";

	let errors = {
		"couch-url": ""
	};

	const handleSubmit: EventHandler<Event & { readonly submitter: HTMLElement }, HTMLFormElement> = (event) => {
		const formData = new FormData(event.target as HTMLFormElement);

		const couchUrl = formData.get("couch-url") as string;

		const urlRegex = new RegExp("^(https?://)(.+):(.+)@(.+):(.+)$");

		if (couchUrl && urlRegex.test(couchUrl)) {
			errors["couch-url"] = "";
			remoteCouchConfigStore.set({ couchUrl });

			toastSuccess("Remote CouchDB URL updated");
		} else {
			errors["couch-url"] =
				"URL should have format https://<COUCHDB_USER:<COUCHDB_PASSWORD>@<COUCHDB_HOST>:<COUCHDB_PORT>/${DB_NAME}";
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
						isValid={errors?.["couch-url"] ? true : false}
						required
					>
						<p slot="helpText">{errors?.["couch-url"] || ""}</p>
					</TextField>
					<div class="self-end">
						<Button type="submit">Save settings</Button>
					</div>
				</div>
			</form>
		</div>
	</div>
</InventoryPage>
