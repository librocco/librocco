<script lang="ts">
	import { type createDialog } from "@melt-ui/svelte";
	import { superForm, superValidateSync, type SuperForm, setError } from "sveltekit-superforms/client";

	import { Dialog, Input } from "$lib/components";
	import { databaseDeleteSchema } from "$lib/forms/schemas";

	export let dialog: ReturnType<typeof createDialog>;
	export let dialogTitle: string;
	export let dialogDescription: string;

	type Form = SuperForm<ReturnType<typeof databaseDeleteSchema>, unknown>;

	export let name: string;
	const matchConfirmation = name
		.toLowerCase()
		// Remove file extension
		.replaceAll(".sqlite3", "")
		// Replace all special characters and spaces with underscores
		.replace(/[^a-z0-9]/g, "_")
		// Remove duplicate underscores
		.replace(/_+/g, "_")
		// Trim leading and trailing underscores
		.replace(/^_+|_+$/g, "");
	const schema = databaseDeleteSchema(matchConfirmation);

	export let options: Form["options"];

	const form = superForm(superValidateSync({}, schema), options);

	const { form: formStore, constraints, enhance } = form;
</script>

<form use:enhance method="POST">
	<Dialog {dialog} type="delete">
		<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
		<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>

		<!-- Additional dialog content -->
		<Input
			bind:value={$formStore.confirmation}
			class="mt-4"
			label="Confirm by typing database name"
			helpText="Type '{matchConfirmation}'"
			name="confirm"
			placeholder={matchConfirmation}
			{...$constraints.confirmation}
			autocomplete="off"
		/>
		<!-- Additional dialog content end -->

		<svelte:fragment slot="confirm-button">
			<button class="button button-red" type="submit">
				<span class="button-text">Confirm</span>
			</button>
		</svelte:fragment>
	</Dialog>
</form>
