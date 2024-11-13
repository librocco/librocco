<script lang="ts">
	import { superForm, defaults } from "sveltekit-superforms/client";
	import { zod } from "sveltekit-superforms/adapters";

	import { databaseCreateSchema, type DatabaseCreateFormSchema } from "$lib/forms/schemas";
	import { Input } from "$lib/components/FormControls";

	import type { FormOptions } from "sveltekit-superforms/client";

	export let options: FormOptions<DatabaseCreateFormSchema>;
	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(defaults(zod(databaseCreateSchema)), options);

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
