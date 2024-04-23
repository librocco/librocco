<script lang="ts" context="module">
	import type { SuperForm } from "sveltekit-superforms/client";

	type SettingsForm = SuperForm<ZodValidation<typeof settingsSchema>, unknown>;
	export type SettingsFormOptions = SettingsForm["options"];
</script>

<script lang="ts">
	import type { SuperValidated, ZodValidation } from "sveltekit-superforms";
	import { superForm, superValidateSync } from "sveltekit-superforms/client";

	import { Input } from "$lib/components";

	import { settingsSchema, type SettingsData } from "$lib/forms/schemas";

	export let form: SuperValidated<typeof settingsSchema>;
	export let options: SettingsFormOptions;

	const _form = superForm(form, options);

	const { form: formStore, enhance } = _form;
</script>

<form class="flex h-auto flex-col gap-y-6" use:enhance method="POST" aria-label="Edit remote database connection config">
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="basis-full">
				<Input id="url" name="couchUrl" label="Remote CouchDB URL" bind:value={$formStore.couchUrl}>
					<p slot="helpText">URL format: <span class="italic">https://user:password@host:post/db_name</span></p>
				</Input>
			</div>

			<div class="basis-full">
				<Input
					id="url"
					name="labelPrinterUrl"
					label="Label Printer URL"
					pattern="^(https?://)(.+):(.+)@(.+):(.+)$"
					bind:value={$formStore.labelPrinterUrl}
				/>
			</div>
		</div>
	</div>
	<div class="flex justify-end gap-x-2 px-4 py-6">
		<button type="submit" class="button button-green">Save and Reload</button>
	</div>
</form>
