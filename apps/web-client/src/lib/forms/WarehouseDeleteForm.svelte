<script lang="ts">
	import { type createDialog } from "@melt-ui/svelte";
	import { superForm, superValidateSync, type SuperForm } from "sveltekit-superforms/client";

	import { Dialog, Input } from "$lib/components";
	import { warehouseDeleteSchema } from "$lib/forms/schemas";

	export let dialog: ReturnType<typeof createDialog>;
	export let dialogTitle: string;
	export let dialogDescription: string;

	type Form = SuperForm<ReturnType<typeof warehouseDeleteSchema>, unknown>;

	export let displayName: string;
	const matchConfirm = displayName.toLowerCase().replaceAll(" ", "_");
	const schema = warehouseDeleteSchema(matchConfirm);

	export let options: Form["options"];
	let data = { confirm: "" };

	const form = superForm(superValidateSync(data, schema), options);

	const { form: formStore, errors, constraints, enhance } = form;

	$: error = $errors.confirm?.[0];
	$: if (error) form.reset();
</script>

<form use:enhance method="POST">
	<Dialog {dialog} type="delete">
		<svelte:fragment slot="title">{dialogTitle}</svelte:fragment>
		<svelte:fragment slot="description">{dialogDescription}</svelte:fragment>
		<svelte:fragment slot="confirmation">
			<Input
				bind:value={$formStore.confirm}
				class="mt-4"
				label="Confirm by typing warehouse name"
				helpText="Type '{matchConfirm}'"
				name="confirm"
				placeholder={matchConfirm}
				{...$constraints.confirm}
				autocomplete="off"
				{error}
			/>
		</svelte:fragment>
	</Dialog>
</form>
