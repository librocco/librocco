<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import type { SuperForm } from "sveltekit-superforms/client";
	import { superForm, superValidateSync } from "sveltekit-superforms/client";

	import { databaseCreateSchema } from "$lib/forms/schemas";

	import { Input } from "$lib/components/FormControls";

	type Form = SuperForm<ZodValidation<typeof databaseCreateSchema>, unknown>;

	export let options: Form["options"];
	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(superValidateSync({ name: "" }, databaseCreateSchema), options);

	const { form: formStore, constraints, enhance } = form;
</script>

<form class="flex max-w-lg flex-col gap-y-6" aria-label="Create new database" use:enhance method="POST" id="database-create-form">
	<div class="flex flex-col justify-between gap-y-6 p-6">
		<div class="basis-full">
			<Input bind:value={$formStore.name} name="name" label="Name" placeholder="Database name" {...$constraints.name} />
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button class="button button-alert" on:click={onCancel} type="button"> Cancel </button>
		<button class="button button-green"> Save </button>
	</div>
</form>
