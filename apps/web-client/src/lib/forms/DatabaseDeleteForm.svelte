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
		<div class="mt-4">
			<label class="form-control">
				<div class="label">
					<span class="label-text">Confirm by typing database name</span>
				</div>
				<input 
					bind:value={$formStore.confirmation}
					name="confirm"
					placeholder={matchConfirmation}
					{...$constraints.confirmation}
					autocomplete="off"
					class="input input-bordered w-full"
				/>
				<div class="label">
					<span class="label-text-alt">Type '{matchConfirmation}'</span>
				</div>
			</label>
		</div>
		<!-- Additional dialog content end -->

		<svelte:fragment slot="confirm-button">
			<button class="btn btn-error" type="submit">
				<span>Confirm</span>
			</button>
		</svelte:fragment>
	</Dialog>
</form>
