<script lang="ts">
	import { superForm, defaults } from "sveltekit-superforms/client";
	import { zod } from "sveltekit-superforms/adapters";

	import { Dialog, Input } from "$lib/components";
	import { databaseDeleteSchema, type DatabaseDeleteFormSchema } from "$lib/forms/schemas";

	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import type { createDialog } from "@melt-ui/svelte";

	export let dialog: ReturnType<typeof createDialog>;
	export let dialogTitle: string;
	export let dialogDescription: string;

	export let options: FormOptions<DatabaseDeleteFormSchema>;

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

	const form = superForm(defaults(zod(schema)), options);

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
